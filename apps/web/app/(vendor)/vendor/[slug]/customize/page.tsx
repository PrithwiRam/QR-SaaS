'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'

interface ThemePreset {
  id: string
  name: string
  desc: string
  bg: string
  text: string
  cardBg: string
  fontFamily: string
  radius: string
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic',
    name: '✨ Classic Premium',
    desc: 'Deep clean luxury look with modern stark elements.',
    bg: 'var(--bg-primary)',
    text: 'var(--text-primary)',
    cardBg: 'var(--bg-secondary)',
    fontFamily: 'Outfit, sans-serif',
    radius: '16px',
  },
  {
    id: 'midnight',
    name: '🌙 Midnight Obsidian',
    desc: 'Ultra-luxurious dark elegance with soft glowing elements.',
    bg: '#0B0F19',
    text: '#F3F4F6',
    cardBg: '#111827',
    fontFamily: 'Outfit, sans-serif',
    radius: '12px',
  },
  {
    id: 'gilded',
    name: '👑 Royal Gilded Truffle',
    desc: 'Elegant warm charcoal & premium champagne gold details for fine dining.',
    bg: '#0F0F11',
    text: '#F5F5F0',
    cardBg: '#17171C',
    fontFamily: 'Outfit, sans-serif',
    radius: '20px',
  },
  {
    id: 'organic',
    name: '🌿 Earthy Sage',
    desc: 'Soft warm organic look ideal for premium cafes & bistros.',
    bg: '#F4F6F0',
    text: '#1F2937',
    cardBg: '#FFFFFF',
    fontFamily: 'Georgia, serif',
    radius: '24px',
  },
  {
    id: 'minimalist',
    name: '⚫ Sleek Stark',
    desc: 'Bold minimalist monochrome styling for fine-dining.',
    bg: '#FFFFFF',
    text: '#000000',
    cardBg: '#F9FAFB',
    fontFamily: 'monospace',
    radius: '0px',
  },
]

export default function CustomizePage() {
  const params = useParams()
  const slug = params?.slug as string

  const [restaurant, setRestaurant] = useState<any>(null)
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [themeColor, setThemeColor] = useState('#6c63ff')
  const [menuTheme, setMenuTheme] = useState('classic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function handleLogoUpload(file: File) {
    setError('')
    setMessage('')
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setLogoUrl(e.target.result as string)
      }
    }
    reader.onerror = () => {
      setError('Failed to read uploaded image file')
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!slug) return
    async function loadSettings() {
      try {
        const data = await api.getPublicMenu(slug)
        if (data && data.restaurant) {
          setRestaurant(data.restaurant)
          setName(data.restaurant.name || '')
          setLogoUrl(data.restaurant.logoUrl || '')
          setThemeColor(data.restaurant.themeColor || '#6c63ff')
          setMenuTheme(data.restaurant.menuTheme || 'classic')
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load restaurant details')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [slug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.customizeSettings({
        restaurantId: restaurant?.id,
        name,
        logoUrl: logoUrl.trim() || null,
        themeColor,
        menuTheme,
      })
      setRestaurant(res)
      setMessage('🎉 Customization saved successfully! Check out your live menu to view changes.')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const selectedPreset = THEME_PRESETS.find(p => p.id === menuTheme) || THEME_PRESETS[0]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>🎨 Customize Menu</h1>
          <p>Style your restaurant's digital menu to match your premium brand identity</p>
        </div>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="customize-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
        
        {/* Left Hand Options Panel */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Identity Card */}
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              🏪 Brand Identity
            </h2>
            <div className="grid-2" style={{ gap: '1.5rem' }}>
              <div className="form-group">
                <label>Restaurant Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Pizza Palace"
                  required
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Restaurant Logo</label>
                <div style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-secondary)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  minHeight: '120px'
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
                onClick={() => document.getElementById('logo-file-input')?.click()}
                >
                  <input
                    id="logo-file-input"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                    style={{ display: 'none' }}
                  />
                  {logoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }}
                      />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Logo Uploaded</div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={e => {
                            e.stopPropagation();
                            setLogoUrl('');
                          }}
                          style={{
                            marginTop: '0.4rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: 'var(--accent-red)',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            minHeight: '28px'
                          }}
                        >
                          🗑️ Delete Logo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '2rem' }}>📤</div>
                      <div>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Click to upload logo</span> or drag and drop
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          PNG, JPG or WEBP (Max 5MB)
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Premium Theme Selector */}
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              ✨ Predefined Premium Themes
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Select from our limited, high-end, premium layout presets built to make your menu stand out.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {THEME_PRESETS.map(preset => (
                <div
                  key={preset.id}
                  onClick={() => {
                    setMenuTheme(preset.id);
                    if (preset.id === 'gilded') {
                      setThemeColor('#D4AF37');
                    } else if (preset.id === 'midnight') {
                      setThemeColor('#ff6584');
                    } else if (preset.id === 'organic') {
                      setThemeColor('#10b981');
                    } else if (preset.id === 'classic') {
                      setThemeColor('#6c63ff');
                    }
                  }}
                  style={{
                    border: `2px solid ${menuTheme === preset.id ? themeColor : 'var(--border-subtle)'}`,
                    borderRadius: '12px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    background: 'var(--bg-secondary)',
                    transition: 'all 0.2s',
                    transform: menuTheme === preset.id ? 'translateY(-2px)' : 'none',
                    boxShadow: menuTheme === preset.id ? `0 4px 15px rgba(0,0,0,0.1)` : 'none',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {preset.name}
                    {menuTheme === preset.id && <span style={{ color: themeColor }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                    {preset.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Accent Color */}
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              🎨 Brand Accent Color
            </h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { hex: '#6C63FF', name: 'Royal Indigo' },
                { hex: '#10B981', name: 'Emerald Jade' },
                { hex: '#F59E0B', name: 'Amber Gold' },
                { hex: '#EF4444', name: 'Coral Crimson' },
                { hex: '#111827', name: 'Obsidian Black' },
              ].map(color => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => setThemeColor(color.hex)}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: color.hex,
                    border: `3px solid ${themeColor === color.hex ? 'var(--text-primary)' : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    transform: themeColor === color.hex ? 'scale(1.1)' : 'none',
                  }}
                  title={color.name}
                />
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Custom Hex:</span>
                <input
                  type="color"
                  value={themeColor}
                  onChange={e => setThemeColor(e.target.value)}
                  style={{ width: '42px', height: '42px', border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
            style={{ alignSelf: 'flex-start', minWidth: '200px', background: themeColor, borderColor: themeColor }}
          >
            {saving ? 'Saving changes...' : 'Save Design Configuration'}
          </button>
        </form>

        {/* Right Hand Smartphone Live Mockup Preview */}
        <div>
          <div style={{ position: 'sticky', top: '100px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              📱 Live Customer Menu Mockup
            </h3>
            
            {/* Phone Case Frame */}
            <div style={{
              width: '320px',
              height: '580px',
              margin: '0 auto',
              border: '12px solid #2A2F3E',
              borderRadius: '36px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              background: selectedPreset.bg,
              color: selectedPreset.text,
              fontFamily: selectedPreset.fontFamily,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              textAlign: 'left',
              position: 'relative',
            }}>
              {/* Speaker & Notch */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '120px',
                height: '18px',
                background: '#2A2F3E',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
                zIndex: 10,
              }} />

              {/* Status bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1.5rem 0.5rem', fontSize: '0.65rem', opacity: 0.6 }}>
                <span>9:41</span>
                <span>📶 🔋</span>
              </div>

              {/* Menu Mockup Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingTop: '0.5rem' }}>
                
                {/* Logo or placeholder */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                      onError={(e: any) => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: themeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}>
                      {name ? name.slice(0, 1).toUpperCase() : '🏪'}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{name || 'Restaurant Name'}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>📋 Table 4</div>
                  </div>
                </div>

                {/* Categories tab */}
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', overflowX: 'hidden' }}>
                  <span style={{
                    background: themeColor,
                    color: 'white',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '20px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}>
                    Popular
                  </span>
                  {['Starters', 'Mains', 'Desserts'].map(cat => (
                    <span
                      key={cat}
                      style={{
                        background: 'rgba(128,128,128,0.1)',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '20px',
                        fontSize: '0.65rem',
                      }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Demo item card */}
                <div style={{
                  background: selectedPreset.cardBg,
                  borderRadius: selectedPreset.radius,
                  padding: '0.75rem',
                  border: '1px solid rgba(128,128,128,0.15)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Margherita Gourmet Pizza</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.7, marginTop: '2px' }}>Mozzarella, fresh basil, organic tomato</div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: themeColor, marginTop: '4px' }}>₹ 320.00</div>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: themeColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Demo item card 2 */}
                <div style={{
                  background: selectedPreset.cardBg,
                  borderRadius: selectedPreset.radius,
                  padding: '0.75rem',
                  border: '1px solid rgba(128,128,128,0.15)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Classic Mint Mojito</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.7, marginTop: '2px' }}>Fresh lime, handpicked mint sprigs</div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: themeColor, marginTop: '4px' }}>₹ 150.00</div>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: themeColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    +
                  </button>
                </div>

              </div>

              {/* Cart Bar Preview */}
              <div style={{
                background: themeColor,
                color: 'white',
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                fontWeight: 700,
                alignItems: 'center',
              }}>
                <span>🛒 1 Item Added</span>
                <span>View Order · ₹ 320.00 →</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* CSS override to support responsive layout for customize page */}
      <style jsx global>{`
        @media (max-width: 992px) {
          .customize-layout {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }
      `}</style>
    </div>
  )
}
