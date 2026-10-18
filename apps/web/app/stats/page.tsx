import {readStats, type StatItem} from '@viup/core';
import {refreshStatsNow} from '../actions';
import {ActionButton} from '../ui';

export const dynamic = 'force-dynamic';

// Khung giờ đăng (giờ Việt Nam)
const SLOTS = [
	{id: 'sang', label: 'Sáng 6–11h', from: 6, to: 11},
	{id: 'trua', label: 'Trưa 11–14h', from: 11, to: 14},
	{id: 'chieu', label: 'Chiều 14–18h', from: 14, to: 18},
	{id: 'toi', label: 'Tối 18–22h', from: 18, to: 22},
	{id: 'khuya', label: 'Khuya 22–6h', from: 22, to: 30},
];
const vnHour = (iso: string) => Number(new Date(iso).toLocaleString('en-US', {timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false})) % 24;
const slotOf = (iso: string) => {
	const h = vnHour(iso);
	return SLOTS.find((s) => (h >= s.from && h < s.to) || (h + 24 >= s.from && h + 24 < s.to))!;
};
const formatOf = (title: string) => (/cung|hoàng đạo|cự giải|zodiac/i.test(title) ? 'Cung hoàng đạo' : 'Sự thật thú vị');
const MATURE_H = 48; // lượt xem còn tăng mạnh trong 2 ngày đầu -> chỉ so sánh video đã đăng > 48h
const ageH = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;
const fmt = (n: number) => n.toLocaleString('vi-VN', {maximumFractionDigits: 0});
const pct = (n: number) => `${(n * 100).toLocaleString('vi-VN', {maximumFractionDigits: 1})}%`;
const engagement = (v: StatItem) => (v.views ? (v.likes + v.comments + (v.shares ?? 0)) / v.views : 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

type Group = {label: string; n: number; avgViews: number; avgEng: number};
const groupBy = (items: StatItem[], key: (v: StatItem) => string, labels?: string[]): Group[] => {
	const map = new Map<string, StatItem[]>((labels ?? []).map((l) => [l, []]));
	for (const v of items) map.set(key(v), [...(map.get(key(v)) ?? []), v]);
	return [...map].map(([label, vs]) => ({label, n: vs.length, avgViews: avg(vs.map((v) => v.views)), avgEng: avg(vs.map(engagement))}));
};

function Bars({groups, caption}: {groups: Group[]; caption: string}) {
	const max = Math.max(1, ...groups.map((g) => g.avgViews));
	return (
		<table className="bars">
			<caption className="muted small">{caption}</caption>
			<thead>
				<tr>
					<th></th>
					<th>Xem trung bình</th>
					<th className="num">Số video</th>
					<th className="num">Tương tác</th>
				</tr>
			</thead>
			<tbody>
				{groups.map((g) => (
					<tr key={g.label} title={`${g.label}: ${fmt(g.avgViews)} lượt xem TB · ${g.n} video · tương tác ${pct(g.avgEng)}`}>
						<td className="barlabel">{g.label}</td>
						<td>
							<div className="bar">
								{g.n > 0 && <span style={{width: `${Math.max(2, (g.avgViews / max) * 100)}%`}} />}
								<b>{g.n ? fmt(g.avgViews) : '—'}</b>
							</div>
						</td>
						<td className="num">{g.n}</td>
						<td className="num">{g.n ? pct(g.avgEng) : '—'}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

// Gợi ý giờ đăng từ dữ liệu; chưa đủ thì nói thẳng là chưa đủ
const advice = (slots: Group[], mature: number) => {
	const tried = slots.filter((s) => s.n >= 2);
	if (mature < 6 || tried.length < 2)
		return `Chưa đủ dữ liệu để kết luận giờ đăng (mới có ${mature} video đăng hơn 2 ngày). Cần ít nhất 2 khung giờ, mỗi khung ≥ 2 video. Mẹo: mỗi ngày đăng 3 video vào 3 khung khác nhau (vd 11h, 19h, 21h) để 1–2 tuần nữa so được.`;
	const best = [...tried].sort((a, b) => b.avgViews - a.avgViews)[0];
	const worst = [...tried].sort((a, b) => a.avgViews - b.avgViews)[0];
	const untried = slots.filter((s) => s.n < 2).map((s) => s.label);
	return `Khung ${best.label} đang tốt nhất (${fmt(best.avgViews)} lượt xem TB), ${worst.label} kém nhất (${fmt(worst.avgViews)}). Dồn video vào ${best.label}${untried.length ? `, nhưng vẫn thử thêm ${untried.join(', ')} để so` : ''}.`;
};

export default async function StatsPage() {
	const snap = readStats();
	const platforms = ['tiktok', 'youtube'] as const;
	const live = (snap?.items ?? []).filter((v) => v.platform === 'tiktok' || v.privacy === 'public');
	const mature = live.filter((v) => ageH(v.publishedAt) >= MATURE_H);
	const slots = groupBy(mature, (v) => slotOf(v.publishedAt).label, SLOTS.map((s) => s.label));
	const formats = groupBy(mature, (v) => formatOf(v.title), ['Sự thật thú vị', 'Cung hoàng đạo']);
	const top = [...live].sort((a, b) => b.views - a.views);

	return (
		<>
			<div className="card row">
				<div>
					<h2>Thống kê</h2>
					<span className="muted small">
						{snap ? `Cập nhật lúc ${new Date(snap.fetchedAt).toLocaleString('vi-VN')}` : 'Chưa lấy số liệu lần nào'} · tự cập nhật mỗi lần tool chạy (7:00, 15:30)
					</span>
				</div>
				<ActionButton action={refreshStatsNow} className="btn small">
					↻ Cập nhật số liệu
				</ActionButton>
			</div>

			{snap &&
				Object.entries(snap.errors).map(([p, e]) => (
					<div key={p} className="card warnbox small">
						<b>{p === 'tiktok' ? 'TikTok' : 'YouTube'}: chưa lấy được số liệu.</b>{' '}
						{p === 'tiktok' && /scope|permission|unauthorized|access_token/i.test(e)
							? 'Cần bật quyền video.list cho app TikTok rồi đăng nhập lại (npm run tt:auth).'
							: e}
					</div>
				))}

			<div className="stats">
				{platforms.map((p) => {
					const vs = live.filter((v) => v.platform === p);
					return (
						<div key={p} className="card stat">
							<div className="muted small">{p === 'tiktok' ? 'TikTok' : 'YouTube'} · {vs.length} video công khai</div>
							<div className="hero">{fmt(vs.reduce((a, v) => a + v.views, 0))}</div>
							<div className="muted small">
								lượt xem · TB {fmt(avg(vs.map((v) => v.views)))}/video · tương tác {pct(avg(vs.map(engagement)))}
							</div>
						</div>
					);
				})}
			</div>

			<div className="card">
				<h2>Giờ đăng có ổn không?</h2>
				<p className="advice">{advice(slots, mature.length)}</p>
				<Bars groups={slots} caption="Lượt xem trung bình theo khung giờ đăng (giờ VN), chỉ tính video đã đăng hơn 2 ngày" />
			</div>

			<div className="card">
				<h2>Loại nội dung nào hiệu quả?</h2>
				<Bars groups={formats} caption="Lượt xem trung bình theo định dạng, video đã đăng hơn 2 ngày" />
			</div>

			<div className="card">
				<h2>Từng video</h2>
				{top.length === 0 ? (
					<p className="muted">Chưa có video công khai nào. Video nháp / riêng tư không tính.</p>
				) : (
					<div className="tablewrap">
						<table>
							<thead>
								<tr>
									<th>Video</th>
									<th>Đăng lúc</th>
									<th className="num">Xem</th>
									<th className="num">Thích</th>
									<th className="num">B.luận</th>
									<th className="num">Chia sẻ</th>
									<th className="num">Tương tác</th>
								</tr>
							</thead>
							<tbody>
								{top.map((v) => (
									<tr key={`${v.platform}-${v.id}`}>
										<td>
											<span className={`badge ${v.platform}`}>{v.platform === 'tiktok' ? 'TikTok' : 'YouTube'}</span>{' '}
											<a href={v.url} target="_blank" rel="noreferrer">
												{v.title}
											</a>
										</td>
										<td className="num muted">
											{new Date(v.publishedAt).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'})}
										</td>
										<td className="num">{fmt(v.views)}</td>
										<td className="num">{fmt(v.likes)}</td>
										<td className="num">{fmt(v.comments)}</td>
										<td className="num">{v.shares === undefined ? '—' : fmt(v.shares)}</td>
										<td className="num">{pct(engagement(v))}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="muted small">Tương tác = (thích + bình luận + chia sẻ) / lượt xem. Trên 5% là tốt cho Shorts.</p>
			</div>
		</>
	);
}
