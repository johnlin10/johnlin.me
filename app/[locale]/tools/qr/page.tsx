import { createClient } from '@/app/lib/supabase/server'
import { getQrCodes } from '@/app/lib/supabase/qrCodes'
import QrTool from './QrTool'

/**
 * QR Code 產生器。首屏清單在伺服器端抓，編碼本身全在瀏覽器算。
 */
export default async function QrPage() {
  const initial = await getQrCodes(await createClient()).catch(() => null)
  return <QrTool initial={initial} />
}
