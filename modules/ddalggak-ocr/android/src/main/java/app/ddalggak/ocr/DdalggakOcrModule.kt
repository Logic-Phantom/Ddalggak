package app.ddalggak.ocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.SystemClock
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min

/**
 * On-device text recognition (ML Kit, bundled Korean model — also reads Latin).
 * Nothing is uploaded by this module. Error messages never contain paths or recognized text,
 * because JS logs them (src/domain/errors.ts).
 */
class DdalggakOcrModule : Module() {
  private var recognizer: TextRecognizer? = null

  private val context: Context
    get() = appContext.reactContext ?: throw OcrException("ERR_OCR_NO_CONTEXT", "React context unavailable")

  private fun client(): TextRecognizer =
    recognizer ?: TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build()).also { recognizer = it }

  override fun definition() = ModuleDefinition {
    Name("DdalggakOcr")

    Function("isAvailable") { true }

    AsyncFunction("recognizeImage") Coroutine { uri: String, maxSide: Int ->
      withContext(Dispatchers.Default) {
        val started = SystemClock.elapsedRealtime()
        val parsed = Uri.parse(uri)
        val bitmap = decodeSampled(parsed, maxSide.coerceIn(512, 4096))
        val rotation = exifRotation(parsed)
        try {
          val text = recognize(bitmap, rotation)
          result(listOf(text), 1, 1, SystemClock.elapsedRealtime() - started)
        } finally {
          bitmap.recycle()
        }
      }
    }

    AsyncFunction("recognizePdf") Coroutine { uri: String, maxPages: Int, maxSide: Int ->
      withContext(Dispatchers.Default) {
        val started = SystemClock.elapsedRealtime()
        val pfd = try {
          context.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
        } catch (e: Exception) {
          null
        } ?: throw OcrException("ERR_OCR_FILE", "File could not be opened")
        val texts = mutableListOf<Text>()
        var pageCount = 0
        try {
          val renderer = try {
            PdfRenderer(pfd)
          } catch (e: SecurityException) {
            throw OcrException("ERR_OCR_PDF_PROTECTED", "PDF is password protected")
          } catch (e: Exception) {
            throw OcrException("ERR_OCR_PDF_INVALID", "PDF could not be read")
          }
          try {
            pageCount = renderer.pageCount
            val pages = min(pageCount, maxPages.coerceIn(1, 10))
            for (i in 0 until pages) {
              val page = renderer.openPage(i)
              try {
                // PDF page sizes are in points (1/72 inch); render around 2x, capped by maxSide.
                val longest = max(page.width, page.height).coerceAtLeast(1)
                val scale = min(maxSide.coerceIn(512, 4096).toFloat() / longest, 3f)
                val bitmap = allocate((page.width * scale).toInt().coerceAtLeast(1), (page.height * scale).toInt().coerceAtLeast(1))
                try {
                  bitmap.eraseColor(Color.WHITE)
                  page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                  texts.add(recognize(bitmap, 0))
                } finally {
                  bitmap.recycle()
                }
              } finally {
                page.close()
              }
            }
          } finally {
            renderer.close()
          }
        } finally {
          pfd.close()
        }
        result(texts, pageCount, texts.size, SystemClock.elapsedRealtime() - started)
      }
    }

    OnDestroy {
      recognizer?.close()
      recognizer = null
    }
  }

  private suspend fun recognize(bitmap: Bitmap, rotation: Int): Text =
    try {
      client().process(InputImage.fromBitmap(bitmap, rotation)).await()
    } catch (e: OutOfMemoryError) {
      throw OcrException("ERR_OCR_MEMORY", "Not enough memory")
    } catch (e: Exception) {
      throw OcrException("ERR_OCR_ENGINE", "Recognition failed")
    }

  private fun allocate(width: Int, height: Int): Bitmap =
    try {
      Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    } catch (e: OutOfMemoryError) {
      throw OcrException("ERR_OCR_MEMORY", "Not enough memory")
    }

  /** Decodes with power-of-two subsampling so the longest side stays at or below `maxSide`. */
  private fun decodeSampled(uri: Uri, maxSide: Int): Bitmap {
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    try {
      // With inJustDecodeBounds the decode itself returns null; only a missing stream is an error.
      val stream = resolver.openInputStream(uri) ?: throw OcrException("ERR_OCR_FILE", "File could not be opened")
      stream.use { BitmapFactory.decodeStream(it, null, bounds) }
    } catch (e: OcrException) {
      throw e
    } catch (e: Exception) {
      throw OcrException("ERR_OCR_FILE", "File could not be opened")
    }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw OcrException("ERR_OCR_DECODE", "Image could not be decoded")
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > maxSide) sample *= 2
    val options = BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    return try {
      resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
        ?: throw OcrException("ERR_OCR_DECODE", "Image could not be decoded")
    } catch (e: OcrException) {
      throw e
    } catch (e: OutOfMemoryError) {
      throw OcrException("ERR_OCR_MEMORY", "Not enough memory")
    } catch (e: Exception) {
      throw OcrException("ERR_OCR_DECODE", "Image could not be decoded")
    }
  }

  /** Camera photos are often stored sideways with an EXIF orientation tag. */
  private fun exifRotation(uri: Uri): Int =
    try {
      context.contentResolver.openInputStream(uri)?.use {
        when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
          ExifInterface.ORIENTATION_ROTATE_90, ExifInterface.ORIENTATION_TRANSPOSE -> 90
          ExifInterface.ORIENTATION_ROTATE_180, ExifInterface.ORIENTATION_FLIP_VERTICAL -> 180
          ExifInterface.ORIENTATION_ROTATE_270, ExifInterface.ORIENTATION_TRANSVERSE -> 270
          else -> 0
        }
      } ?: 0
    } catch (e: Exception) {
      0
    }

  private fun result(texts: List<Text>, pageCount: Int, pagesRead: Int, durationMs: Long): Map<String, Any?> {
    val lines = mutableListOf<Map<String, Any?>>()
    for (text in texts) {
      for (block in text.textBlocks) {
        for (line in block.lines) {
          val box = line.boundingBox
          lines.add(
            mapOf(
              "text" to line.text,
              "box" to box?.let { mapOf("x" to it.left, "y" to it.top, "width" to it.width(), "height" to it.height()) },
            ),
          )
        }
      }
    }
    return mapOf(
      "text" to texts.joinToString("\n\n") { it.text },
      "lines" to lines,
      "engine" to "mlkit-text-recognition-korean",
      "engineVersion" to "16.0.1",
      "durationMs" to durationMs,
      "pageCount" to pageCount,
      "pagesRead" to pagesRead,
    )
  }
}

class OcrException(code: String, message: String) : CodedException(code, message, null)
