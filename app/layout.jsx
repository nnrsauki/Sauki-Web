import './globals.css';

export const metadata = {
  title: 'Sauki Data',
  description: 'Buy Cheap Data Instantly - Government Certified',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
         <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
      </head>
      <body className="antialiased bg-slate-50">
        {children}
      </body>
    </html>
  );
}

