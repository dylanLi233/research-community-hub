"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteResponse = {
  data?: { deleted?: boolean };
  error?: { message?: string };
};

export function AssetDeleteButton({
  assetId,
  filename,
}: {
  assetId: string;
  filename: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`确认删除素材“${filename}”吗？删除后公开地址将立即失效。`)) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/admin/assets/${assetId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as DeleteResponse;

      if (!response.ok || !payload.data?.deleted) {
        setError(payload.error?.message ?? "删除失败，请稍后重试");
        return;
      }

      router.refresh();
    } catch {
      setError("网络连接失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="asset-delete-control">
      <button
        type="button"
        className="admin-secondary-button"
        onClick={handleDelete}
        disabled={submitting}
      >
        {submitting ? "正在删除…" : "删除"}
      </button>
      {error ? (
        <small className="asset-inline-error" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
