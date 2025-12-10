import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Sauki Data',
  description: 'Buy Cheap Data Instantly - Government Certified',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
  icons: {
    icon: '/logo.png', // Uses your logo as the favicon
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-slate-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}


