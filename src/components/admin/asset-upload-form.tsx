"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type UploadResponse = {
  data?: { asset?: { id: string } };
  error?: { message?: string };
};

export function AssetUploadForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/assets", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || !payload.data?.asset?.id) {
        setError(payload.error?.message ?? "上传失败，请稍后重试");
        return;
      }

      form.reset();
      setMessage("图片已上传并写入素材库。");
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="asset-upload-form" onSubmit={handleSubmit}>
      <label>
        <span>图片文件</span>
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={submitting}
        />
        <small>支持 JPEG、PNG、WebP，单文件最大 10 MB。</small>
      </label>
      <label>
        <span>图片说明</span>
        <input
          name="altText"
          type="text"
          maxLength={300}
          placeholder="用于无障碍阅读和图片加载失败提示"
          disabled={submitting}
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "正在上传…" : "上传图片"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="form-success" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
