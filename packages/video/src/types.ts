export type Emotion = 'vui' | 'buon' | 'ngacnhien' | 'binhthuong';

// Hình minh hoạ: tên icon Fluent Emoji Flat (xem scripts/icons.ts) + số lượng
export type Prop = {
	icon: string;
	count: number;
};

export type Line = {
	text: string;
	emotion: Emotion;
	start: number;
	end: number;
	props: Prop[];
	label: string | null;
};

// Sinh ra bởi tools/tts/make_voice.py
export type Manifest = {
	fps: number;
	duration: number;
	lines: Line[];
	envelope: number[];
};
