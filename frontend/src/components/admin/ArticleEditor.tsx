'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './ArticleEditor.module.css';

export interface MediaAttachment {
  id?: string;
  file_url: string;
  media_type: 'image' | 'video';
  file?: File;
}

export interface ArticleFormData {
  title: string;
  content_html: string;
  category: string;
  content_type: string;
  status: string;
}

interface ArticleEditorProps {
  /** Initial form values (for editing) */
  initialData?: Partial<ArticleFormData>;
  /** Initial media attachments (for editing) */
  initialMedia?: MediaAttachment[];
  /** Submit handler */
  onSubmit: (data: ArticleFormData, newFiles: File[]) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Submit button label */
  submitLabel?: string;
  /** Whether the form is submitting */
  submitting?: boolean;
}

const CATEGORIES = [
  { value: 'trading', label: 'Trading' },
  { value: 'life_story', label: 'Life Story' },
  { value: 'general', label: 'General' },
];

const CONTENT_TYPES = [
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
];

const STATUSES = [
  { value: 'published', label: 'Published' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'draft', label: 'Draft' },
];

/**
 * Article editor component with HTML textarea, preview, and media upload.
 * Uses a simple textarea for HTML content with a basic formatting toolbar
 * and a live preview tab.
 *
 * Requirements: 5.2, 6.1, 6.2, 6.3
 */
export function ArticleEditor({
  initialData,
  initialMedia = [],
  onSubmit,
  onCancel,
  submitLabel = 'Simpan',
  submitting = false,
}: ArticleEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [contentHtml, setContentHtml] = useState(initialData?.content_html ?? '');
  const [category, setCategory] = useState(initialData?.category ?? 'general');
  const [contentType, setContentType] = useState(initialData?.content_type ?? 'short');
  const [status, setStatus] = useState(initialData?.status ?? 'published');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [media, setMedia] = useState<MediaAttachment[]>(initialMedia);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Insert HTML tag around selected text in the textarea */
  const insertTag = useCallback((tag: string, closingTag?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = contentHtml.substring(start, end);
    const close = closingTag ?? `</${tag.replace('<', '').replace('>', '')}>`;
    const replacement = `${tag}${selected}${close}`;

    const newContent = contentHtml.substring(0, start) + replacement + contentHtml.substring(end);
    setContentHtml(newContent);

    // Restore focus and cursor position
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + tag.length + selected.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }, [contentHtml]);

  /** Handle file selection for media upload */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setError('Hanya file gambar dan video yang diperbolehkan.');
      return;
    }

    setError('');
    const newAttachments: MediaAttachment[] = validFiles.map((file) => ({
      file_url: URL.createObjectURL(file),
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      file,
    }));

    setMedia((prev) => [...prev, ...newAttachments]);
    setNewFiles((prev) => [...prev, ...validFiles]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /** Remove a media attachment */
  const removeMedia = useCallback((index: number) => {
    setMedia((prev) => {
      const item = prev[index];
      // Revoke object URL if it's a local file
      if (item.file) {
        URL.revokeObjectURL(item.file_url);
      }
      return prev.filter((_, i) => i !== index);
    });
    setNewFiles((prev) => {
      // Find and remove the corresponding file
      const mediaItem = media[index];
      if (mediaItem?.file) {
        return prev.filter((f) => f !== mediaItem.file);
      }
      return prev;
    });
  }, [media]);

  /** Handle form submission */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!contentHtml.trim()) {
      setError('Konten HTML tidak boleh kosong.');
      // Focus the textarea for inline feedback
      textareaRef.current?.focus();
      return;
    }

    if (title.trim().length > 500) {
      setError('Judul tidak boleh lebih dari 500 karakter.');
      return;
    }

    try {
      await onSubmit(
        {
          title: title.trim(),
          content_html: contentHtml,
          category,
          content_type: contentType,
          status,
        },
        newFiles,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan artikel.');
    }
  };

  return (
    <form className={styles.editorContainer} onSubmit={handleSubmit}>
      {/* Title */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="article-title">
          Judul
        </label>
        <input
          id="article-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul artikel (opsional)"
        />
      </div>

      {/* Category + Content Type + Status */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="article-category">
            Kategori
          </label>
          <select
            id="article-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel} htmlFor="article-content-type">
            Tipe Konten
          </label>
          <select
            id="article-content-type"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="article-status">
          Status
        </label>
        <select
          id="article-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* HTML Editor */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Konten HTML</label>
        <div className={styles.editorWrapper}>
          <div className={styles.editorToolbar}>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<strong>', '</strong>')}
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<em>', '</em>')}
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<u>', '</u>')}
              title="Underline"
            >
              <u>U</u>
            </button>
            <div className={styles.toolbarSeparator} />
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<h2>', '</h2>')}
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<h3>', '</h3>')}
              title="Heading 3"
            >
              H3
            </button>
            <div className={styles.toolbarSeparator} />
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<p>', '</p>')}
              title="Paragraph"
            >
              ¶
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<a href="">', '</a>')}
              title="Link"
            >
              🔗
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<blockquote>', '</blockquote>')}
              title="Blockquote"
            >
              &ldquo;
            </button>

            {/* Write / Preview tabs */}
            <div className={styles.tabBar}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'write' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('write')}
              >
                Write
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'preview' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                Preview
              </button>
            </div>
          </div>

          {activeTab === 'write' ? (
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              placeholder="Tulis konten HTML di sini..."
            />
          ) : (
            <div
              className={styles.preview}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}
        </div>
      </div>

      {/* Media Attachments */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Media</label>
        <div className={styles.mediaSection}>
          {media.length > 0 && (
            <div className={styles.mediaGrid}>
              {media.map((item, index) => (
                <div key={item.id ?? index} className={styles.mediaThumb}>
                  {item.media_type === 'video' ? (
                    <video src={item.file_url} muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.file_url} alt={`Media ${index + 1}`} />
                  )}
                  <button
                    type="button"
                    className={styles.mediaRemoveBtn}
                    onClick={() => removeMedia(index)}
                    aria-label={`Hapus media ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            className={styles.uploadArea}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
          >
            📎 Klik untuk menambahkan gambar atau video
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.uploadInput}
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* Error message */}
      {error && <p className={styles.errorText}>{error}</p>}

      {/* Actions */}
      <div className={styles.formActions}>
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Batal
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Menyimpan...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
