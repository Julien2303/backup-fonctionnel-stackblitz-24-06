import type { Metadata } from 'next';
import Link from 'next/link';
import NavigationMenu from './NavigationMenu';
import './globals.css'; // Importer les styles Tailwind
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Importer les styles de react-toastify

export const metadata: Metadata = {
  title: 'Planning Radiologues',
  description: 'Gestion des plannings médicaux',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen flex flex-col bg-gray-50"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <header className="bg-gradient-to-r from-blue-800 to-blue-600 text-white sticky top-0 z-50 shadow-md">
          <nav className="container mx-auto p-3">
            <div className="flex justify-between items-center">
              <Link href="/">
                <div className="font-bold text-xl tracking-tight">
                  Planning Radiologues
                </div>
              </Link>
              <NavigationMenu />
            </div>
          </nav>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>

        <footer className="bg-gray-100 border-t border-gray-200 py-4">
          <div className="container mx-auto text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} Planning Radiologues
          </div>
        </footer>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}