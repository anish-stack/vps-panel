import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'VPS Panel - Server Management',
  description: 'Manage your VPS servers from one dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
