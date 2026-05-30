'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useVendorCtx } from '@/app/(vendor)/vendor-context'

export default function MenuManagePage() {
  const params = useParams()
  const slug = params?.slug as string
  const ctx = useVendorCtx()
  const restaurantId = ctx?.restaurantId ?? null
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modals
  const [showCatModal, setShowCatModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [selectedCat, setSelectedCat] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)

  const [catForm, setCatForm] = useState({ name: '', sortOrder: 0 })
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    sortOrder: 0,
    isAvailable: true,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (restaurantId) loadMenu(restaurantId)
    else setLoading(false)
  }, [restaurantId])


  function showMsg(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function loadMenu(rid: string) {
    setLoading(true)
    setError('')
    try {
      const data = await api.getCategories(rid)
      setCategories(data || [])
      if (data?.length > 0 && !selectedCat) setSelectedCat(data[0].id)
    } catch (e: any) {
      setError(e.message || 'Failed to load menu')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCat(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return
    setSubmitting(true)
    setError('')
    try {
      await api.createCategory(restaurantId, catForm)
      setShowCatModal(false)
      setCatForm({ name: '', sortOrder: 0 })
      showMsg('Category added!')
      await loadMenu(restaurantId)
    } catch (e: any) {
      setError(e.message || 'Failed to add category')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurantId) return
    setSubmitting(true)
    setError('')
    try {
      const priceVal = parseFloat(itemForm.price)
      if (isNaN(priceVal) || priceVal <= 0) {
        setError('Please enter a valid price greater than 0')
        setSubmitting(false)
        return
      }
      const data = { ...itemForm, price: priceVal, description: itemForm.description.trim() || null }
      if (editItem) {
        const updated = await api.updateItem(restaurantId, editItem.id, data)
        // Optimistic update
        setCategories(prev => prev.map(cat => ({
          ...cat,
          items: cat.id === updated.categoryId
            ? cat.items?.map((it: any) => it.id === updated.id ? { ...it, ...updated } : it)
            : cat.items
        })))
        showMsg('Item updated!')
      } else {
        const created = await api.createItem(restaurantId, data)
        // Optimistic insert
        setCategories(prev => prev.map(cat =>
          cat.id === created.categoryId
            ? { ...cat, items: [...(cat.items || []), created] }
            : cat
        ))
        showMsg('Item added!')
      }
      closeItemModal()
    } catch (e: any) {
      setError(e.message || 'Failed to save item')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteItem() {
    if (!confirmDelete || !restaurantId) return
    setSubmitting(true)
    setError('')
    try {
      const res: any = await api.deleteItem(restaurantId, confirmDelete.id)
      if (res.softDeleted) {
        // Mark as hidden in place
        setCategories(prev => prev.map(cat => ({
          ...cat,
          items: cat.items?.map((it: any) =>
            it.id === confirmDelete.id ? { ...it, isAvailable: false } : it
          )
        })))
        showMsg('Item has order history — hidden from customer menu instead of deleted')
      } else {
        // Remove from list
        setCategories(prev => prev.map(cat => ({
          ...cat,
          items: cat.items?.filter((it: any) => it.id !== confirmDelete.id)
        })))
        showMsg('Item deleted')
      }
      setConfirmDelete(null)
    } catch (e: any) {
      setError(e.message || 'Failed to delete item')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleAvailability(item: any) {
    if (!restaurantId) return
    setError('')
    const next = !item.isAvailable
    // Optimistic update first
    setCategories(prev => prev.map(cat => ({
      ...cat,
      items: cat.items?.map((it: any) =>
        it.id === item.id ? { ...it, isAvailable: next } : it
      )
    })))
    try {
      await api.updateItem(restaurantId, item.id, { isAvailable: next })
      showMsg(next ? 'Item enabled on menu' : 'Item hidden from menu')
    } catch (e: any) {
      // Revert on error
      setCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items?.map((it: any) =>
          it.id === item.id ? { ...it, isAvailable: item.isAvailable } : it
        )
      })))
      setError(e.message || 'Failed to update availability')
    }
  }

  function openAddItem() {
    setEditItem(null)
    setItemForm({
      name: '',
      description: '',
      price: '',
      categoryId: selectedCat || categories[0]?.id || '',
      sortOrder: 0,
      isAvailable: true,
    })
    setError('')
    setShowItemModal(true)
  }

  function openEditItem(item: any) {
    setEditItem(item)
    setItemForm({
      name: item.name,
      description: item.description || '',
      price: String(Number(item.price).toFixed(2)),
      categoryId: item.categoryId,
      sortOrder: item.sortOrder,
      isAvailable: item.isAvailable,
    })
    setError('')
    setShowItemModal(true)
  }

  function closeItemModal() {
    setShowItemModal(false)
    setEditItem(null)
    setError('')
  }

  if (loading) return <div className="loading-spinner" />

  const activeCat = categories.find((c: any) => c.id === selectedCat)
  const allItemsCount = categories.reduce((s: number, c: any) => s + (c.items?.length || 0), 0)

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1>Menu Management</h1>
          <p>
            {allItemsCount} items across {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => { setCatForm({ name: '', sortOrder: 0 }); setError(''); setShowCatModal(true) }}>
            + Category
          </button>
          <button
            id="add-item-btn"
            className="btn btn-primary"
            onClick={openAddItem}
            disabled={categories.length === 0}
            title={categories.length === 0 ? 'Add a category first' : 'Add a menu item'}
          >
            + Menu Item
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>✓ {success}</div>
      )}

      {/* No categories yet */}
      {categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🍽️</div>
          <div className="empty-state-title">No menu categories yet</div>
          <div className="empty-state-desc">
            Add a category first (e.g. &quot;Starters&quot;, &quot;Mains&quot;, &quot;Drinks&quot;), then add items to it.
          </div>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setShowCatModal(true)}>
            + Add First Category
          </button>
        </div>
      ) : (
        <>
          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {categories.map((c: any) => (
              <button
                key={c.id}
                className={`cat-tab ${selectedCat === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCat(c.id)}
              >
                {c.name}
                <span style={{ opacity: 0.7, marginLeft: '4px' }}>
                  ({c.items?.length || 0})
                </span>
              </button>
            ))}
          </div>

          {/* Items Table */}
          {activeCat && (
            <div className="table-wrapper">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontWeight: 600 }}>{activeCat.name}</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setItemForm(f => ({ ...f, categoryId: activeCat.id }))
                    openAddItem()
                  }}
                >
                  + Add Item to {activeCat.name}
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!activeCat.items || activeCat.items.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state" style={{ padding: '2rem' }}>
                          <div className="empty-state-desc">No items in this category yet</div>
                          <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={openAddItem}>
                            + Add first item
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    activeCat.items.map((item: any) => (
                      <tr key={item.id} style={{ opacity: item.isAvailable ? 1 : 0.6 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {item.name}
                            {!item.isAvailable && (
                              <span className="badge badge-inactive" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Hidden</span>
                            )}
                          </div>
                          {item.description && (
                            <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'Outfit, sans-serif' }}>
                          ₹{Number(item.price).toFixed(2)}
                        </td>
                        <td>
                          {/* Availability Toggle */}
                          <button
                            onClick={() => toggleAvailability(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              background: item.isAvailable ? 'rgba(16,185,129,0.12)' : 'rgba(153,153,187,0.1)',
                              border: `1px solid ${item.isAvailable ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
                              borderRadius: '6px',
                              padding: '0.3rem 0.7rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: item.isAvailable ? 'var(--accent-green)' : 'var(--text-secondary)',
                              transition: 'all 0.2s',
                              fontFamily: 'inherit',
                            }}
                            title={item.isAvailable ? 'Click to hide from menu' : 'Click to show on menu'}
                          >
                            <span style={{ fontSize: '0.7rem' }}>{item.isAvailable ? '●' : '○'}</span>
                            {item.isAvailable ? 'Available' : 'Hidden'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditItem(item)}>
                              ✏️ Edit
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setConfirmDelete(item)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── Add Category Modal ─────────────────────────────── */}
      {showCatModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div className="modal">
            <div className="modal-title">New Category</div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreateCat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Category Name *</label>
                <input
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Starters, Mains, Desserts, Drinks"
                  required
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Add / Edit Item Modal ──────────────────────────── */}
      {showItemModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeItemModal()}>
          <div className="modal" style={{ maxWidth: '560px' }}>
            <div className="modal-title">{editItem ? '✏️ Edit Menu Item' : '+ New Menu Item'}</div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Category selector */}
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={itemForm.categoryId}
                  onChange={e => setItemForm(f => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  value={itemForm.name}
                  onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Grilled Salmon, Margherita Pizza"
                  required
                  autoFocus={!editItem}
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  value={itemForm.description}
                  onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description shown to customers..."
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Price + Availability */}
              <div className="grid-2">
                <div className="form-group">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={itemForm.price}
                    onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Visibility on Menu</label>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => setItemForm(f => ({ ...f, isAvailable: val }))}
                        style={{
                          flex: 1,
                          padding: '0.6rem',
                          borderRadius: '8px',
                          border: `1px solid ${itemForm.isAvailable === val ? (val ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.4)') : 'var(--border-subtle)'}`,
                          background: itemForm.isAvailable === val ? (val ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent',
                          color: itemForm.isAvailable === val ? (val ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          fontFamily: 'inherit',
                          transition: 'all 0.2s',
                        }}
                      >
                        {val ? '● Visible' : '○ Hidden'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeItemModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ──────────────────────── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal">
            <div className="modal-title">🗑️ Delete &quot;{confirmDelete.name}&quot;?</div>
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              If this item has been ordered before, it will be <strong>hidden from the menu</strong> instead of permanently deleted (to preserve order history).
            </div>
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Items with no order history will be permanently deleted.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteItem}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
