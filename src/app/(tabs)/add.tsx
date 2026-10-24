import { Redirect } from 'expo-router';

/** Placeholder route behind the center "+" tab button (the button navigates to /capture directly). */
export default function AddTab() {
  return <Redirect href="/capture" />;
}
