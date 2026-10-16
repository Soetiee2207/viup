import {schema} from '@viup/core';
import {getDb} from '@/lib/db';
import {saveSettings} from '../actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
	const db = await getDb();
	const [channel] = await db.select().from(schema.channels).limit(1);
	const fun = Math.round((channel?.formats['fun-fact'] ?? 0.6) * 100);

	return (
		<div className="card">
			<h2>Cài đặt kênh</h2>
			<form action={saveSettings} className="settings">
				<label>
					<span>Số video mỗi ngày</span>
					<input type="number" name="videosPerDay" min={1} max={10} defaultValue={channel?.videosPerDay ?? 3} />
				</label>
				<label>
					<span>Tỉ lệ “Sự thật thú vị” (%) — phần còn lại là Cung hoàng đạo</span>
					<input type="number" name="funFact" min={0} max={100} step={10} defaultValue={fun} />
				</label>
				<label className="check">
					<input type="checkbox" name="active" defaultChecked={channel?.active ?? true} />
					<span>Tự động làm video theo giờ (bỏ tick = tạm dừng)</span>
				</label>
				<button className="btn primary">Lưu</button>
			</form>
			<p className="muted small">
				Giờ tự chạy: 7:00 và 15:30 mỗi ngày (15:30 để chạy bù khi lượt Gemini đã reset). Mỗi lần chỉ làm đủ video cho hôm nay và ngày mai. Gemini free ~20 lượt/ngày cho bản
				chính, mỗi video tốn 2–7 lượt; nhiều hơn ~5 video/ngày thì tool sẽ dùng bản lite (kém hơn).
			</p>
		</div>
	);
}
