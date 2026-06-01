import { Slot } from 'expo-router';
import '../global.css';
import NotificationsProvider from '../src/components/NotificationsProvider';
import ErrorBoundary from '../src/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <NotificationsProvider />
      <Slot />
    </ErrorBoundary>
  );
}