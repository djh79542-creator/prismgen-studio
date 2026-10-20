import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Studio from './app/Studio';
import ConsoleSignIn from './ui/console/sign-in';
import CreditOperations from './ui/console/credit-operations';
import { LanguageProvider } from './i18n/provider';
import { ThemeProvider } from './theme/provider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/console/sign-in" element={<ConsoleSignIn />} />
        <Route path="/console/credits" element={<CreditOperations />} />
        <Route path="/*" element={
          <LanguageProvider>
            <ThemeProvider>
              <Studio />
            </ThemeProvider>
          </LanguageProvider>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);