import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {z} from 'zod';
import {Scene, stickerText, type CrabConfig} from './Scene';
import {Subtitle} from './Subtitle';
import {buildTimeline, type Scene as SceneData} from './timeline';
import type {Manifest} from './types';

// Các tuỳ chỉnh này sửa trực tiếp được trong Remotion Studio (bảng Props bên phải)
export const shortSchema = z.object({
	characterImage: z.string().describe('Ảnh nhân vật trong public/, vd character/body.png — để trống = nhân vật mẫu'),
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
	music: z.string().describe('Nhạc nền mặc định trong public/ (spec.json có "music" thì dùng của spec) — để trống = không nhạc'),
	musicVolume: z.number().min(0).max(1),
	sfxVolume: z.number().min(0).max(1),
});

export type ShortProps = z.infer<typeof shortSchema> & {manifest?: Manifest};

const TRANSITION_FRAMES = 8;

// Độ to giọng xung quanh khung hình (cho ducking)
const talkingNear = (envelope: number[], frame: number, radius: number) => {
	let talking = 0;
	for (let i = frame - radius; i <= frame + radius; i++) talking = Math.max(talking, envelope[i] ?? 0);
	return talking;
};

// Nhạc nền tự nhỏ lại khi cua nói (ducking), fade-in đầu và fade-out cuối video
const musicVolume = (frame: number, manifest: Manifest, base: number, total: number) => {
	const {fps} = manifest;
	const duck = interpolate(talkingNear(manifest.envelope, frame, 6), [0.05, 0.3], [1, 0.45], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const fade = Math.min(
		interpolate(frame, [0, fps * 0.5], [0, 1], {extrapolateRight: 'clamp'}),
		interpolate(frame, [total - fps * 1.2, total], [1, 0], {extrapolateLeft: 'clamp'}),
	);
	return base * duck * fade;
};

// Biến đổi lúc chuyển cảnh: p = 0 -> 1 trong TRANSITION_FRAMES khung hình đầu cảnh mới
const enterStyle = (kind: SceneData['transition'], p: number): React.CSSProperties => {
	if (kind === 'slide') return {transform: `translateX(${(1 - p) * 100}%)`};
	if (kind === 'spin') return {transform: `rotate(${(1 - p) * -14}deg) scale(${0.55 + 0.45 * p})`, opacity: Math.min(1, p * 2)};
	if (kind === 'zoom') return {transform: `scale(${1 + (1 - p) * 0.6})`, opacity: Math.min(1, p * 1.6)};
	return {};
};
const exitStyle = (kind: SceneData['transition'], p: number): React.CSSProperties =>
	kind === 'slide' ? {transform: `translateX(${-p * 100}%)`} : {};

const Hook: React.FC<{text: string; end: number}> = ({text, end}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const slam = spring({frame, fps, config: {damping: 12, stiffness: 260, overshootClamping: true}});
	const out = interpolate(frame, [end - 6, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const shake = frame < 12 ? (1 - frame / 12) * 16 : 0;
	return (
		<div
			style={{
				...stickerText,
				position: 'absolute',
				top: 150,
				left: 40,
				right: 40,
				fontSize: text.length > 16 ? 112 : 136,
				color: '#ffd43b',
				WebkitTextStroke: '22px #1b1430',
				textTransform: 'uppercase',
				opacity: out,
				transform: `translate(${(random(`hx${frame}`) - 0.5) * shake}px, ${(random(`hy${frame}`) - 0.5) * shake}px) rotate(-4deg) scale(${(2.4 - 1.4 * slam) * (0.9 + 0.1 * out)})`,
			}}
		>
			{text}
		</div>
	);
};

export const Short: React.FC<ShortProps> = ({manifest, ...p}) => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	const timeline = useMemo(() => (manifest ? buildTimeline(manifest, durationInFrames) : null), [manifest, durationInFrames]);
	if (!manifest || !timeline) return null;
	const {scenes, sfx, hookEnd} = timeline;

	const i = Math.max(0, scenes.findLastIndex((s) => s.from <= frame));
	const scene = scenes[i];
	const prev = scenes[i - 1];
	const tf = frame - scene.from;
	const inTransition = prev && tf < TRANSITION_FRAMES && scene.transition !== 'cut' && scene.transition !== 'flash';
	const progress = Easing.out(Easing.cubic)(Math.min(1, tf / TRANSITION_FRAMES));
	// Làm mượt độ to giọng để miệng không giật
	const env = manifest.envelope;
	const talk = ((env[frame - 1] ?? 0) + (env[frame] ?? 0) * 2 + (env[frame + 1] ?? 0)) / 4;
	const crab: CrabConfig = {image: p.characterImage, face: p.face};
	const music = manifest.music ?? p.music;

	return (
		<AbsoluteFill style={{background: '#1b1430'}}>
			{inTransition && (
				<AbsoluteFill style={exitStyle(scene.transition, progress)}>
					<Scene scene={prev} crab={crab} talk={talk} />
				</AbsoluteFill>
			)}
			<AbsoluteFill style={inTransition ? enterStyle(scene.transition, progress) : undefined}>
				<Scene scene={scene} crab={crab} talk={talk} />
			</AbsoluteFill>
			{scene.transition === 'flash' && tf < TRANSITION_FRAMES && (
				<AbsoluteFill style={{background: 'white', opacity: 1 - tf / TRANSITION_FRAMES}} />
			)}
			{frame < hookEnd && manifest.hook && <Hook text={manifest.hook} end={hookEnd} />}
			<div style={{position: 'absolute', top: 1190, left: 40, right: 40}}>
				<Subtitle words={scene.words} startFrame={scene.from} />
			</div>
			<Audio src={staticFile('voice.wav')} />
			{music && (
				<Audio src={staticFile(music)} loop volume={(f) => musicVolume(f, manifest, p.musicVolume, durationInFrames)} />
			)}
			{sfx.map((e, k) => (
				<Sequence key={k} from={e.frame} durationInFrames={fps * 2} layout="none">
					{/* SFX cũng được duck nhẹ khi đang nói */}
					<Audio
						src={staticFile(`sfx/${e.sound}.mp3`)}
						volume={p.sfxVolume * e.volume * (talkingNear(env, e.frame, 2) > 0.3 ? 0.7 : 1)}
					/>
				</Sequence>
			))}
		</AbsoluteFill>
	);
};
