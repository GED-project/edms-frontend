import { Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './pages/register/page';
import { LoginPage } from './pages/login/page';
import { ForgotPasswordPage } from './pages/forgot-password/page';
import { ResetPasswordPage } from './pages/reset-password/page';

export default function AuthModule() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route index element={<Navigate to="login" replace />} />
    </Routes>
  );
}
