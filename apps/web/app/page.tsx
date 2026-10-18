import Link from 'next/link';
import {readPublishSettings} from '@viup/core';
import {addDays, listDays, listVideos, localDate, PLATFORM_LABEL, PLATFORMS} from '@/lib/viup';
import {deleteVideo, pushDraftsNow, togglePosted} from './actions';
import {ActionButton, CopyButton} from './ui';

export const dynamic = 'force-dynamic';

const dayLabel = (day: string, today: string) =>
	day === today ? 'Hôm nay' : day === addDays(today, 1) ? 'Ngày mai' : day === addDays(today, -1) ? 'Hôm qua' : new Date(`${day}T12:00:00`).toLocaleDateString('vi-VN', {weekday: 'short', day: '2-digit', month: '2-digit'});

export default async function VideosPage({searchParams}: {searchParams: Promise<{day?: string}>}) {
	const today = localDate();
	const {day: picked} = await searchParams;
	const day = picked && /^\d{4}-\d{2}-\d{2}$/.test(picked) ? picked : today;
	const days = [...new Set([...listDays().filter((d) => d >= addDays(today, -7)), today, addDays(today, 1)])].sort();
	const videos = listVideos(day);
	const draftOn = readPublishSettings();
	const draftPlatforms = (['tiktok', 'youtube'] as const).filter((p) => draftOn[p]);
	const missingDrafts = videos.some((v) => draftPlatforms.some((p) => !v.uploads[p]?.id));

	return (
		<>
			<div className="days">
				{days.map((d) => {
					const n = listVideos(d);
					const done = n.filter((v) => PLATFORMS.some((p) => v.posted[p])).length;
					return (
						<Link key={d} href={d === today ? '/' : `/?day=${d}`} className={d === day ? 'day active' : 'day'}>
							<span>{dayLabel(d, today)}</span>
							<small>
								{n.length} video{n.length ? ` · ${done} đã đăng` : ''}
							</small>
						</Link>
					);
				})}
			</div>

			{videos.length > 0 && missingDrafts && day >= today && (
				<div className="card row">
					<span className="muted">
						Video ngày này chưa đẩy nháp hết. Lần tự chạy sẽ đẩy video <b>hôm nay</b>; muốn có sớm thì bấm.
					</span>
					<ActionButton action={pushDraftsNow.bind(null, day)} className="btn small">
						⇪ Đẩy nháp {draftPlatforms.map((p) => PLATFORM_LABEL[p]).join(' + ')} ngay
					</ActionButton>
				</div>
			)}

			{videos.length === 0 ? (
				<div className="card empty">
					<p>Chưa có video cho ngày này.</p>
					<p className="muted">Bấm “▶ Làm video ngay” ở trên, hoặc đợi lần tự chạy kế tiếp.</p>
				</div>
			) : (
				<div className="videos">
					{videos.map((v, i) => (
						<article key={v.file} className="card video">
							<video src={`/api/video/${day}/${encodeURIComponent(v.file)}#t=1.5`} controls preload="metadata" playsInline />
							<div className="info">
								<div className="muted">
									Video {i + 1} · {v.sizeMb.toFixed(1)} MB
								</div>
								<h3>{v.youtubeTitle.replace(/ #Shorts$/, '') || v.topic}</h3>

								<div className="field">
									<label>TikTok / Facebook</label>
									<div className="copyrow">
										<code>{v.caption}</code>
										<CopyButton text={v.caption} label="Copy" />
									</div>
								</div>
								<div className="field">
									<label>YouTube — tiêu đề</label>
									<div className="copyrow">
										<code>{v.youtubeTitle}</code>
										<CopyButton text={v.youtubeTitle} label="Copy" />
									</div>
								</div>
								<div className="field">
									<label>YouTube — mô tả</label>
									<div className="copyrow">
										<code>
											<span className="clamp">{v.description}</span>
										</code>
										<CopyButton text={v.description} label="Copy" />
									</div>
								</div>

								{draftPlatforms.length > 0 && (
									<div className="field">
										<label>Nháp</label>
										<div className="platforms small">
											{draftPlatforms.map((p) => {
												const u = v.uploads[p];
												if (u?.id)
													return p === 'youtube' ? (
														<a key={p} className="badge ok" href={u.url} target="_blank" rel="noreferrer">
															{v.posted.youtube ? '✓ Đã có trên YouTube' : '✓ YouTube riêng tư — mở Studio'}
														</a>
													) : (
														<span key={p} className="badge ok" title="Mở app TikTok trên điện thoại → Hộp thư → thông báo video sẵn sàng">
															{v.posted.tiktok ? '✓ Đã có trên TikTok' : '✓ Nháp TikTok (xem trên điện thoại)'}
														</span>
													);
												if (u?.error)
													return (
														<span key={p} className="badge warn" title={u.error}>
															✗ {PLATFORM_LABEL[p]} lỗi — sẽ thử lại
														</span>
													);
												return (
													<span key={p} className="badge">
														{PLATFORM_LABEL[p]}: chưa đẩy
													</span>
												);
											})}
										</div>
									</div>
								)}

								<div className="field">
									<label>Đã đăng</label>
									<div className="platforms">
										{PLATFORMS.map((p) => (
											<ActionButton key={p} action={togglePosted.bind(null, day, v.file, p)} className={v.posted[p] ? 'chip on' : 'chip'}>
												{v.posted[p] ? '✓ ' : ''}
												{PLATFORM_LABEL[p]}
											</ActionButton>
										))}
									</div>
								</div>
								<div className="actions">
									<a className="btn small" href={`/api/video/${day}/${encodeURIComponent(v.file)}`} download={v.file}>
										Tải file
									</a>
									<ActionButton action={deleteVideo.bind(null, day, v.file)} className="btn small danger" confirm="Xoá video này? Lần tự chạy sau sẽ làm video khác bù vào.">
										Xoá (không ưng)
									</ActionButton>
								</div>
								<p className="hint muted">Nhớ bật nhãn “nội dung do AI tạo” khi đăng.</p>
							</div>
						</article>
					))}
				</div>
			)}
		</>
	);
}
