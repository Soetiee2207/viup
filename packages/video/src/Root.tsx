import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Short, shortSchema} from './Short';
import type {Manifest} from './types';

export const RemotionRoot: React.FC = () => (
	<Composition
		id="Short"
		component={Short}
		schema={shortSchema}
		// Nút "Save" trong Remotion Studio ghi đè trực tiếp các giá trị này
		defaultProps={{
			// Mascot cua Cự Giải (ảnh vẽ bằng Gemini, xoá nền bằng tools/cut_bg.py). Để '' = nhân vật mẫu
			characterImage: 'character/crab.png',
			characterWidth: 500,
			face: {
				eyeLeftX: 0.394,
				eyeRightX: 0.607,
				eyeY: 0.262,
				eyeSize: 0.052,
				mouthX: 0.5,
				mouthY: 0.35,
				mouthWidth: 0.085,
				color: '#1d1212',
			},
			backgroundImage: '',
			// Nhạc tự tổng hợp bằng tools/music/make_loop.py (không dính bản quyền)
			music: 'music/sunny-reef.mp3',
			musicVolume: 0.45,
			backgroundTop: '#7fd3f7',
			backgroundBottom: '#2f6fd6',
		}}
		width={1080}
		height={1920}
		fps={30}
		durationInFrames={300}
		calculateMetadata={async ({props}) => {
			const res = await fetch(staticFile('manifest.json'));
			if (!res.ok) throw new Error('Chưa có public/manifest.json — hãy chạy "npm run voice" trước');
			const manifest = (await res.json()) as Manifest;
			return {
				fps: manifest.fps,
				// Giữ thêm 0.8s cuối để video không bị cắt cụt
				durationInFrames: Math.ceil((manifest.duration + 0.8) * manifest.fps),
				props: {...props, manifest},
			};
		}}
	/>
);
