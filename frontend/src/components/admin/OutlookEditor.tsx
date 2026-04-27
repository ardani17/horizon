'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './OutlookEditor.module.css';

export interface OutlookFormData {
  title: string;
  content_html: string;
  category: 'outlook';
  status: string;
}

export interface InlineImageEntry {
  file: File;
  blobUrl: string;
}

export interface OutlookInitialData {
  title: string;
  content_html: string;
  status: string;
}

interface InlineImage {
  id: string;
  file: File;
  objectUrl: string;
}

interface OutlookEditorProps {
  /** Submit handler — receives form data and inline images with their blob URLs */
  onSubmit: (data: OutlookFormData, images: InlineImageEntry[]) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Optional initial data for edit mode */
  initialData?: OutlookInitialData;
  /** Submit button label */
  submitLabel?: string;
  /** Whether the form is submitting */
  submitting?: boolean;
}

let imageIdCounter = 0;

/**
 * Outlook editor component with rich text HTML editing, inline image uploads,
 * and live preview. Designed specifically for Outlook (market analysis) articles
 * with fixed category "outlook".
 *
 * Requirements: 27.5, 27.6
 */
export function OutlookEditor({
  onSubmit,
  onCancel,
  initialData,
  submitLabel = 'Publikasikan',
  submitting = false,
}: OutlookEditorProps) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [contentHtml, setContentHtml] = useState(initialData?.content_html ?? '');
  const [status, setStatus] = useState(initialData?.status ?? 'published');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [inlineImages, setInlineImages] = useState<InlineImage[]>([]);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /** Insert HTML tag around selected text in the textarea */
  const insertTag = useCallback((openTag: string, closeTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = contentHtml.substring(start, end);
    const replacement = `${openTag}${selected}${closeTag}`;

    const newContent = contentHtml.substring(0, start) + replacement + contentHtml.substring(end);
    setContentHtml(newContent);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + openTag.length + selected.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }, [contentHtml]);

  /** Insert text at cursor position */
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newContent = contentHtml.substring(0, start) + text + contentHtml.substring(start);
    setContentHtml(newContent);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + text.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }, [contentHtml]);

  /** Handle inline image selection — inserts an img tag placeholder */
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        setError('Hanya file gambar yang diperbolehkan untuk inline image.');
        continue;
      }

      const id = `img-${++imageIdCounter}`;
      const objectUrl = URL.createObjectURL(file);

      setInlineImages((prev) => [...prev, {
        id,
        file,
        objectUrl,
      }]);

      // Insert img tag placeholder at cursor
      insertAtCursor(`\n<img src="${objectUrl}" alt="Outlook image" />\n`);
    }

    setError('');
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, [insertAtCursor]);

  /** Remove an inline image */
  const removeImage = useCallback((id: string) => {
    setInlineImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) {
        // Remove the img tag from content
        setContentHtml((content) =>
          content.replace(new RegExp(`<img[^>]*src="${img.objectUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/?>`, 'g'), '')
        );
        URL.revokeObjectURL(img.objectUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  /** Handle form submission */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Judul artikel Outlook wajib diisi.');
      return;
    }

    if (!contentHtml.trim()) {
      setError('Konten HTML tidak boleh kosong.');
      return;
    }

    try {
      const images: InlineImageEntry[] = inlineImages.map((img) => ({
        file: img.file,
        blobUrl: img.objectUrl,
      }));
      await onSubmit(
        {
          title: title.trim(),
          content_html: contentHtml,
          category: 'outlook',
          status,
        },
        images,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan artikel Outlook.');
    }
  };

  return (
    <form className={styles.editorContainer} onSubmit={handleSubmit}>
      {/* Fixed category/type info banner */}
      <div className={styles.infoBanner}>
        <span className={styles.infoBadge}>📈 Outlook</span>
        <span className={styles.infoText}>
          Kategori: <strong>Outlook</strong> · Tipe: <strong>Long-form</strong> · Sumber: <strong>Dashboard</strong>
        </span>
      </div>

      {/* Title */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="outlook-title">
          Judul <span className={styles.required}>*</span>
        </label>
        <input
          id="outlook-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul analisa market..."
          required
        />
      </div>

      {/* Status */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="outlook-status">
          Status
        </label>
        <select
          id="outlook-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="published">Published</option>
          <option value="draft">Draft</option>
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
              onClick={() => insertTag('<ul>\n  <li>', '</li>\n</ul>')}
              title="Unordered List"
            >
              • List
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => insertTag('<ol>\n  <li>', '</li>\n</ol>')}
              title="Ordered List"
            >
              1. List
            </button>
            <div className={styles.toolbarSeparator} />
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
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => imageInputRef.current?.click()}
              title="Insert Inline Image"
            >
              🖼️
            </button>
            <input
              ref={imageInputRef}
              type="file"
              className={styles.hiddenInput}
              accept="image/*"
              multiple
              onChange={handleImageSelect}
            />

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
              placeholder="Tulis analisa market Anda di sini..."
            />
          ) : (
            <div
              className={styles.preview}
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}
        </div>
      </div>

      {/* Inline Images List */}
      {inlineImages.length > 0 && (
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Inline Images ({inlineImages.length})</label>
          <div className={styles.imageList}>
            {inlineImages.map((img) => (
              <div key={img.id} className={styles.imageItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.objectUrl} alt="Inline" className={styles.imageThumb} />
                <span className={styles.imageName}>{img.file.name}</span>
                <button
                  type="button"
                  className={styles.imageRemoveBtn}
                  onClick={() => removeImage(img.id)}
                  aria-label={`Hapus ${img.file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
