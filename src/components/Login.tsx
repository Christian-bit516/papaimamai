import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Zap,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Shield
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister]         = useState(false);
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);

  const switchMode = (register: boolean) => {
    setIsRegister(register);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const sanitizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitizedEmail)) {
        setError('El formato del correo electrónico no es válido.');
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', sanitizedEmail);

      if (isRegister) {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setError('Este correo ya está registrado. Intenta iniciar sesión.');
          setLoading(false);
          return;
        }

        const newUser = {
          email: sanitizedEmail,
          password: password,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newUser);
        
        onLoginSuccess({
          email: sanitizedEmail,
          displayName: sanitizedEmail.split('@')[0],
        });
      } else {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          setError('No existe una cuenta con este correo electrónico.');
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        if (userData.password !== password) {
          setError('Contraseña incorrecta. Verifica e intenta de nuevo.');
          setLoading(false);
          return;
        }

        onLoginSuccess({
          email: sanitizedEmail,
          displayName: sanitizedEmail.split('@')[0],
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(`Error al conectar con la base de datos de Firebase: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    onLoginSuccess({
      email: 'demo@capacitaia.edu',
      displayName: 'Usuario Demo',
      isDemo: true,
    });
  };

  return (
    <div className="login-bg">
      <div className="glass-panel login-card animate-fade-in">

        {/* ── Brand ── */}
        <div className="login-brand">
          <div className="login-logo">
            <Zap size={24} color="white" fill="white" />
          </div>
          <h1 className="login-title">CapacitaIA</h1>
          <p className="login-subtitle">
            Plataforma de Predicción de&nbsp;Conversión de Leads
          </p>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${!isRegister ? 'active' : 'inactive'}`}
            onClick={() => switchMode(false)}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`login-tab ${isRegister ? 'active' : 'inactive'}`}
            onClick={() => switchMode(true)}
          >
            Registrarse
          </button>
        </div>

        {/* ── Form ── */}
        <form className="login-form" onSubmit={handleSubmit}>
          {/* Error block */}
          {error && (
            <div className="login-error">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="login-field">
            <label className="login-label">
              <Mail size={13} color="var(--accent-orange)" />
              Correo Electrónico
            </label>
            <div className="login-input-wrap">
              <input
                id="login-email"
                type="email"
                placeholder="ejemplo@capacitaia.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label className="login-label">
              <Lock size={13} color="var(--accent-orange)" />
              Contraseña
            </label>
            <div className="login-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                style={{ paddingRight: '44px' }}
                disabled={loading}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(s => !s)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : isRegister ? (
              <><UserPlus size={17} /> Crear Cuenta</>
            ) : (
              <><LogIn size={17} /> Ingresar</>
            )}
          </button>
        </form>

        {/* ── Divider ── */}
        <div className="login-divider">
          <span className="login-divider-line" />
          <span>O TAMBIÉN</span>
          <span className="login-divider-line" />
        </div>

        {/* ── Demo bypass ── */}
        <button type="button" className="login-demo-btn" onClick={handleDemo}>
          <Sparkles size={15} color="var(--accent-orange)" />
          Ingresar como Demo
        </button>

        {/* ── Footer ── */}
        <p className="login-footer">
          <Shield size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
          Tus datos están guardados en&nbsp;<span>Firebase Firestore</span>
        </p>

      </div>
    </div>
  );
}
