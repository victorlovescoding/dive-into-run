import React from 'react';
import { Geist, Geist_Mono as GeistMono } from 'next/font/google';
import Navbar from '@/components/Navbar/Navbar';
import UserDataHandler from '@/contexts/AuthContext';
import ToastProvider from '@/contexts/ToastContext';
import ToastContainer from '@/components/ToastContainer';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = GeistMono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Dive Into Run',
  description: 'Dive Into Run 跑步社群平台',
  openGraph: {
    siteName: 'Dive Into Run',
    type: 'website',
  },
};

/**
 * 應用程式根佈局，包含導覽列與全域 Provider。
 * @param {object} root0 - 元件屬性。
 * @param {React.ReactNode} root0.children - 子頁面內容。
 * @returns {React.JSX.Element} 根佈局元件。
 */
export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant-TW">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <UserDataHandler>
          <ToastProvider>
            <Navbar />
            {children}
            <ToastContainer />
          </ToastProvider>
        </UserDataHandler>
      </body>
    </html>
  );
}
