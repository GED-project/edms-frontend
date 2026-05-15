import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import {
  User as UserIcon,
  Shield,
  Bell,
  Save,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Check,
  Camera,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Role } from '@/lib/auth-rbac/roles';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAvatar } from '@/lib/useAvatar';
import {
  getMyPreferences,
  updateMyPreferences,
  updateProfile,
  changePassword,
  getProfile,
  type UserPreferencesDto,
} from './settings.service';

type SettingsSection = 'profile' | 'security' | 'preferences';

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6 items-start py-4 border-b border-border last:border-0">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground sm:pt-2">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

// ─── Avatar Upload Component ──────────────────────────────────────────────────

function AvatarUpload() {
  const { avatarUrl, saveAvatar, clearAvatar, initials } = useAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seuls les fichiers image sont acceptés (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      saveAvatar(result);
      toast.success('Photo de profil mise à jour');
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex items-center gap-5">
      {/* Avatar preview */}
      <div
        className={[
          'relative group h-20 w-20 shrink-0 rounded-full overflow-hidden cursor-pointer border-2 transition-all duration-200',
          isDragging
            ? 'border-primary border-dashed scale-105'
            : 'border-border hover:border-primary/60',
        ].join(' ')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        title="Cliquer ou déposer une image"
        id="avatar-upload-zone"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Photo de profil"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-xl font-bold text-primary">
            {initials}
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        id="avatar-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
        aria-label="Choisir une photo de profil"
      />

      {/* Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          id="avatar-change-btn"
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Camera className="h-3.5 w-3.5" />
          Changer la photo
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={() => { clearAvatar(); toast.success('Photo supprimée'); }}
            id="avatar-remove-btn"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        )}
        <p className="text-[10px] text-muted-foreground">
          JPG, PNG ou WebP — max 5 MB
        </p>
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [language, setLanguage] = useState('fr');
  const [preferencesSnapshot, setPreferencesSnapshot] = useState<UserPreferencesDto | null>(null);
  const [saving, setSaving] = useState(false);

  // Load profile + preferences so name and language reflect persisted values.
  useEffect(() => {
    Promise.all([getProfile(), getMyPreferences()])
      .then(([p, prefs]) => {
        setFullName([p.name, p.surname].filter(Boolean).join(' '));
        setLanguage(prefs.language || 'fr');
        setPreferencesSnapshot(prefs);
      })
      .catch(() => {/* keep local fallback values */});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parts = fullName.trim().split(' ');
      const name = parts[0] ?? '';
      const surname = parts.slice(1).join(' ') || name;
      await updateProfile({ name, surname, email: user?.email ?? '' });

      const prefs = preferencesSnapshot ?? await getMyPreferences();
      await updateMyPreferences({
        ...prefs,
        language,
      });
      setPreferencesSnapshot({ ...prefs, language });

      toast.success('Profil mis à jour avec succès');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Informations du profil" description="Modifiez vos informations personnelles.">
      {/* Avatar upload */}
      <div className="pb-5 mb-2 border-b border-border space-y-1">
        <p className="text-xs font-medium text-foreground mb-3">Photo de profil</p>
        <AvatarUpload />
      </div>

      {/* Name info alongside avatar */}
      <div className="flex items-center gap-3 py-3 border-b border-border mb-1">
        <div>
          <p className="text-sm font-semibold text-foreground">{fullName || 'Votre nom'}</p>
          <span className="text-[11px] text-muted-foreground">{user?.email}</span>
        </div>
        <div className="ml-auto">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            user?.role === Role.ADMIN ? 'bg-red-500/10 text-red-500' :
            user?.role === Role.MANAGER ? 'bg-indigo-500/10 text-indigo-500' :
            'bg-blue-500/10 text-blue-500'
          }`}>
            {user?.role === Role.ADMIN ? 'Admin' : user?.role === Role.MANAGER ? 'Manager' : 'Standard User'}
          </span>
        </div>
      </div>

      <Field label="Nom complet" htmlFor="profile-fullname">
        <input
          id="profile-fullname"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </Field>

      <Field label="Adresse e-mail" htmlFor="profile-email">
        <input
          id="profile-email"
          type="email"
          value={user?.email ?? ''}
          disabled
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="text-[11px] text-muted-foreground mt-1">L'adresse e-mail ne peut pas être modifiée ici.</p>
      </Field>

      <Field label="Langue de l'interface" htmlFor="profile-lang">
        <select
          id="profile-lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </Field>

      <div className="flex justify-end pt-4">
        <button
          id="save-profile-btn"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Security Section ─────────────────────────────────────────────────────────

function SecuritySection() {
  const [showModal, setShowModal] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.error('Veuillez remplir les deux champs');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: oldPassword, newPassword });
      setSaving(false);
      setShowModal(false);
      setOldPassword('');
      setNewPassword('');
      toast.success('Mot de passe modifié avec succès');
    } catch (err: any) {
      setSaving(false);
      toast.error(err?.response?.data?.error?.message || 'Erreur lors du changement de mot de passe');
    }
  };

  const currentSession = {
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Navigateur inconnu',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Fuseau inconnu',
  };

  return (
    <>
      <SectionCard title="Sécurité du compte" description="Gérez votre mot de passe et les sessions actives.">
        <div className="space-y-5">
          {/* Change password CTA */}
          <div className="flex items-center justify-between py-4 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Mot de passe</p>
              <p className="text-xs text-muted-foreground">Utilisez un mot de passe fort et unique pour votre compte.</p>
            </div>
            <button
              id="change-password-btn"
              onClick={() => setShowModal(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              Modifier
            </button>
          </div>

          {/* Active sessions */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-3">Sessions actives</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{currentSession.device}</p>
                    <p className="text-[10px] text-muted-foreground">{currentSession.timeZone} · Maintenant</p>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5">Session actuelle</span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Password modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Changer le mot de passe</h3>

            {[
              { id: 'old-pass', label: 'Mot de passe actuel', show: showOld, toggle: () => setShowOld((v) => !v), value: oldPassword, onChange: (v: string) => setOldPassword(v) },
              { id: 'new-pass', label: 'Nouveau mot de passe', show: showNew, toggle: () => setShowNew((v) => !v), value: newPassword, onChange: (v: string) => setNewPassword(v) },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <label htmlFor={f.id} className="text-xs font-medium text-foreground">{f.label}</label>
                <div className="relative">
                  <input
                    id={f.id}
                    type={f.show ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background pr-9 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                  <button
                    type="button"
                    onClick={f.toggle}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Annuler
              </button>
              <button
                id="confirm-change-password-btn"
                onClick={handleChangePassword}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {saving ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Preferences Section ──────────────────────────────────────────────────────

function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [approvalNotifs, setApprovalNotifs] = useState(true);
  const [language, setLanguage] = useState('fr');
  const [saving, setSaving] = useState(false);

  // Load persisted preferences from backend on mount
  useEffect(() => {
    getMyPreferences()
      .then((prefs) => {
        if (prefs.theme) setTheme(prefs.theme);
        setLanguage(prefs.language || 'fr');
        setEmailNotifs(prefs.emailNotifications);
        setApprovalNotifs(prefs.approvalNotifications);
      })
      .catch(() => { /* silent: use local defaults */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const THEMES: { value: string; label: string; icon: React.ElementType }[] = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMyPreferences({
        theme: theme ?? 'system',
        language,
        emailNotifications: emailNotifs,
        approvalNotifications: approvalNotifs,
      });
      toast.success('Préférences sauvegardées');
    } catch {
      toast.error('Erreur lors de la sauvegarde des préférences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Préférences" description="Personnalisez votre expérience dans l'application.">
      <Field label="Thème de l'interface" htmlFor="pref-theme">
        <div className="flex gap-2" id="pref-theme">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={[
                'flex-1 flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all',
                theme === t.value
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              ].join(' ')}
              id={`theme-${t.value}`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {theme === t.value && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Notifications email" htmlFor="pref-email-notif">
        <div className="space-y-3">
          {[
            { id: 'pref-email-notif', label: 'Résumé d\'activité quotidien', desc: 'Recevez un email chaque matin avec les activités de la veille.', state: emailNotifs, setter: setEmailNotifs },
            { id: 'pref-approval-notif', label: 'Alertes de validation', desc: 'Soyez notifié quand un document vous est soumis pour approbation.', state: approvalNotifs, setter: setApprovalNotifs },
          ].map((notif) => (
            <div key={notif.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-foreground">{notif.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{notif.desc}</p>
              </div>
              <button
                id={notif.id}
                role="switch"
                aria-checked={notif.state}
                onClick={() => notif.setter((v) => !v)}
                className={[
                  'relative shrink-0 h-5 w-9 rounded-full border-2 transition-all duration-200',
                  notif.state ? 'bg-primary border-primary' : 'bg-muted border-muted',
                ].join(' ')}
              >
                <span className={[
                  'absolute top-0 left-0 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                  notif.state ? 'translate-x-4' : 'translate-x-0',
                ].join(' ')} />
              </button>
            </div>
          ))}
        </div>
      </Field>

      <div className="flex justify-end pt-4">
        <button
          id="save-prefs-btn"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all shadow-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('tab') as SettingsSection) || 'profile';

  const setActiveSection = (tab: SettingsSection) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profil', icon: UserIcon },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'preferences', label: 'Préférences', icon: Bell },
  ];

  return (
    <>
      <Helmet>
        <title>Paramètres — ItDoc</title>
        <meta name="description" content="Paramètres de compte et préférences utilisateur ItDoc." />
      </Helmet>

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez votre compte et personnalisez votre expérience.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Side nav */}
          <nav className="flex sm:flex-col gap-1 sm:w-48 shrink-0">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                id={`settings-nav-${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-all',
                  activeSection === s.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-4">
            {activeSection === 'profile'     && <ProfileSection />}
            {activeSection === 'security'    && <SecuritySection />}
            {activeSection === 'preferences' && <PreferencesSection />}
          </div>
        </div>
      </div>
    </>
  );
}
