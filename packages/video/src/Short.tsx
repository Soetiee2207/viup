import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {Character} from './Character';
import {Stage} from './Stage';
import {Subtitle} from './Subtitle';
import type {Manifest} from './types';

// Các tuỳ chỉnh này sửa trực tiếp được trong Remotion Studio (bảng Props bên phải)
export const shortSchema = z.object({
	characterImage: z.string().describe('Ảnh nhân vật trong public/, vd character/body.png — để trống = nhân vật mẫu'),
	characterWidth: z.number().min(200).max(1080),
	face: z.object({
		eyeLeftX: z.number().min(0).max(1),
		eyeRightX: z.number().min(0).max(1),
		eyeY: z.number().min(0).max(1),
		eyeSize: z.number().min(0).max(0.5),
		mouthX: z.number().min(0).max(1),
		mouthY: z.number().min(0).max(1),
		mouthWidth: z.number().min(0).max(0.5),
		color: z.string(),
	}),
	backgroundImage: z.string().describe('Ảnh nền 9:16 trong public/, vd background.png — để trống = nền màu'),
	music: z.string().describe('Nhạc nền trong public/, vd music/sunny-reef.mp3 — để trống = không nhạc'),
	musicVolume: z.number().min(0).max(1),
	backgroundTop: z.string(),
	backgroundBottom: z.string(),
});

export type ShortProps = z.infer<typeof shortSchema> & {manifest?: Manifest};

const Bubbles: React.FC = () => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	return (
		<>
			{Array.from({length: 14}, (_, i) => {
				const size = 20 + random(`s${i}`) * 60;
				const speed = 1 + random(`v${i}`) * 2;
				const y = height + 100 - ((frame * speed + random(`y${i}`) * height) % (height + 200));
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: random(`x${i}`) * width,
							top: y,
							width: size,
							height: size,
							borderRadius: '50%',
							border: '4px solid rgba(255,255,255,0.35)',
						}}
					/>
				);
			})}
		</>
	);
};

// Nhạc nền tự nhỏ lại khi cua nói (ducking), fade-in đầu và fade-out cuối video
const musicVolume = (frame: number, manifest: Manifest, base: number, total: number) => {
	const {envelope, fps} = manifest;
	let talking = 0;
	for (let i = frame - 6; i <= frame + 6; i++) talking = Math.max(talking, envelope[i] ?? 0);
	const duck = interpolate(talking, [0.05, 0.3], [1, 0.45], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const fade = Math.min(
		interpolate(frame, [0, fps * 0.5], [0, 1], {extrapolateRight: 'clamp'}),
		interpolate(frame, [total - fps * 1.2, total], [1, 0], {extrapolateLeft: 'clamp'}),
	);
	return base * duck * fade;
};

export const Short: React.FC<ShortProps> = ({manifest, ...p}) => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	if (!manifest) return null;

	const t = frame / fps;
	const lines = manifest.lines;
	const index = Math.max(0, lines.findLastIndex((l) => l.start <= t));
	const line = lines[index];
	const lineFrame = Math.max(0, frame - Math.round(line.start * fps));
	// Câu không khai báo hình thì giữ hình của câu gần nhất phía trước
	const visualIndex = lines.findLastIndex((l, i) => i <= index && l.props.length > 0);
	const visual = visualIndex >= 0 ? lines[visualIndex] : null;
	const visualFrame = visual ? Math.max(0, frame - Math.round(visual.start * fps)) : 0;
	// Làm mượt độ to giọng để miệng không giật
	const env = manifest.envelope;
	const talk = ((env[frame - 1] ?? 0) + (env[frame] ?? 0) * 2 + (env[frame + 1] ?? 0)) / 4;

	const zoom = 1 + (frame / durationInFrames) * 0.08;

	return (
		<AbsoluteFill style={{background: `linear-gradient(${p.backgroundTop}, ${p.backgroundBottom})`}}>
			{p.backgroundImage ? (
				<Img
					src={staticFile(p.backgroundImage)}
					style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}}
				/>
			) : (
				<Bubbles />
			)}
			{visual && <Stage key={visualIndex} line={visual} visualFrame={visualFrame} />}
			{/* Cua dẫn chương trình ở dưới, chừa vùng chú thích/nút của TikTok/Shorts */}
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 200}}>
				<Character
					image={p.characterImage}
					width={p.characterWidth}
					face={p.face}
					emotion={line.emotion}
					talk={talk}
					lineFrame={lineFrame}
				/>
			</AbsoluteFill>
			<div style={{position: 'absolute', top: 905, left: 50, right: 50}}>
				<Subtitle key={index} line={line} lineFrame={lineFrame} />
			</div>
			<Audio src={staticFile('voice.wav')} />
			{p.music && (
				<Audio
					src={staticFile(p.music)}
					loop
					volume={(f) => musicVolume(f, manifest, p.musicVolume, durationInFrames)}
				/>
			)}
		</AbsoluteFill>
	);
};
