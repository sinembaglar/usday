import { useState } from 'react'
import { removeConnection } from '../lib/api'
import { dative } from '../lib/format'
import { t } from '../lib/i18n'

// Ending a connection, optionally blocking the person too.
export default function RemoveConnectionSheet({ connection, person, planCount, onDone, onCancel, onToast }) {
  const [block, setBlock] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await removeConnection(connection.id, block)
      onDone(
        block
          ? t(`🚫 ${person.name} engellendi`, `🚫 ${person.name} is blocked`)
          : t(`${person.name} ile bağlantın kaldırıldı`, `Your connection with ${person.name} was removed`),
      )
    } catch {
      setBusy(false)
      onToast(t('Kaldırılamadı, tekrar dener misin?', 'Couldn’t remove it. Try again?'))
    }
  }

  return (
    <div className="settings">
      <h3>{t(`${person.name} ile bağlantıyı kaldır`, `Remove your connection with ${person.name}`)}</h3>
      <div className="status-box is-declined">
        <strong>{t('Bu işlem geri alınamaz', 'This can’t be undone')}</strong>
        <small>
          {t(
            `Bu bağlantıdaki ${planCount > 0 ? `${planCount} plan, ` : 'planlar, '}yorumlar, şablonlar ve fotoğraflar ikiniz için de silinir. ${dative(person.name)} haber gitmez; seni artık kişilerinde göremez. Dilek listeleriniz kendinizde kalır.`,
            `The ${planCount === 1 ? '1 plan' : planCount > 0 ? `${planCount} plans` : 'plans'}, comments, templates and photos in this connection are deleted for both of you. ${person.name} isn’t told; you just disappear from their people. Your wish lists stay with each of you.`,
          )}
        </small>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        <span>
          <strong>{t('🚫 Ayrıca engelle', '🚫 Also block them')}</strong>
          <small>
            {t(
              'Sana tekrar bağlanamaz, seni grup planlarına davet edemez. Birbirinizin grup planlarından da çıkarılırsınız. Engeli sonra Ayarlar’dan kaldırabilirsin.',
              'They can’t connect with you again or invite you to group plans, and you’re both taken off each other’s group plans. You can unblock them later in Settings.',
            )}
          </small>
        </span>
      </label>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t('Vazgeç', 'Cancel')}
        </button>
        <button className="btn btn-primary danger-fill" onClick={submit} disabled={busy}>
          {busy
            ? t('Kaldırılıyor…', 'Removing…')
            : block
              ? t('Kaldır ve engelle', 'Remove and block')
              : t('Bağlantıyı kaldır', 'Remove connection')}
        </button>
      </div>
    </div>
  )
}
