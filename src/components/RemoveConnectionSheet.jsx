import { useState } from 'react'
import { removeConnection } from '../lib/api'
import { dative } from '../lib/format'

// Ending a connection, optionally blocking the person too.
export default function RemoveConnectionSheet({ connection, person, planCount, onDone, onCancel, onToast }) {
  const [block, setBlock] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await removeConnection(connection.id, block)
      onDone(block ? `🚫 ${person.name} engellendi` : `${person.name} ile bağlantın kaldırıldı`)
    } catch {
      setBusy(false)
      onToast('Kaldırılamadı, tekrar dener misin?')
    }
  }

  return (
    <div className="settings">
      <h3>{person.name} ile bağlantıyı kaldır</h3>
      <div className="status-box is-declined">
        <strong>Bu işlem geri alınamaz</strong>
        <small>
          Bu bağlantıdaki {planCount > 0 ? `${planCount} plan, ` : 'planlar, '}yorumlar, şablonlar ve fotoğraflar ikiniz için de
          silinir. {dative(person.name)} haber gitmez; seni artık kişilerinde göremez. Dilek listeleriniz kendinizde kalır.
        </small>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        <span>
          <strong>🚫 Ayrıca engelle</strong>
          <small>
            Sana tekrar bağlanamaz, seni grup planlarına davet edemez. Birbirinizin grup planlarından da çıkarılırsınız.
            Engeli sonra Ayarlar’dan kaldırabilirsin.
          </small>
        </span>
      </label>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Vazgeç
        </button>
        <button className="btn btn-primary danger-fill" onClick={submit} disabled={busy}>
          {busy ? 'Kaldırılıyor…' : block ? 'Kaldır ve engelle' : 'Bağlantıyı kaldır'}
        </button>
      </div>
    </div>
  )
}
