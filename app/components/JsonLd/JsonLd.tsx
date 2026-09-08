// 依 Next.js 官方建議：JSON-LD 用原生 <script> 而非 next/script（結構化資料非可執行 JS）。
// dangerouslySetInnerHTML 需自行跳脫 `<`，避免內容中出現 `</script>` 之類的注入。
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
