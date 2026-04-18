import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import DeviceSimulator from './components/DeviceSimulator';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <App />
                    <DeviceSimulator />
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    </React.StrictMode>
);


