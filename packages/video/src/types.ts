export type Emotion = 'vui' | 'buon' | 'ngacnhien' | 'binhthuong';

// Bố cục cảnh (xem src/Scene.tsx)
export type Layout = 'crab-presents' | 'crab-closeup' | 'object-hero' | 'versus' | 'count' | 'dialogue';
// Ai nói câu này: cua dẫn chuyện, hoặc nhân vật khách (đồ vật/con vật được nhân hoá, xem Guest)
export type Speaker = 'crab' | 'guest';
// Nhân vật khách của video kể chuyện: icon Fluent Emoji có mặt biết nói + giọng riêng
// voice: nu = giọng nữ, tram = nam trầm, be = giọng nhí (xem tools/tts/make_voice.py)
export type Guest = {icon: string; name: string; voice?: 'nu' | 'tram' | 'be'};
// Nền động (xem src/Background.tsx)
export type Bg = 'burst' | 'speedlines' | 'bokeh' | 'gloom';
// Hiệu ứng âm thanh trong public/sfx/ (tạo bằng tools/music/make_sfx.py)
export type Sfx = 'whoosh' | 'pop' | 'boing' | 'ding' | 'scratch';
// Kiểu chuyển cảnh khi beat bắt đầu
export type Transition = 'slide' | 'zoom' | 'flash' | 'spin' | 'cut';

// Hình minh hoạ: tên icon Fluent Emoji Flat (xem scripts/icons.ts) + số lượng.
// face: gắn mắt/miệng biết nói lên icon (mặc định: có, trừ icon vốn đã có mặt như con vật)
export type Prop = {
	icon: string;
	count?: number;
	face?: boolean;
};

// Một beat ≈ 1–2 giây trong câu. Mọi trường đều tuỳ chọn, engine tự chọn mặc định.
export type Beat = {
	// Beat bắt đầu từ cụm từ này trong câu (vd "ba trái tim"); bỏ trống = engine tự chia theo thời gian/dấu câu
	from?: string;
	layout?: Layout;
	props?: Prop[];
	label?: string;
	bg?: Bg;
	transition?: Transition;
	// Thay cho SFX mặc định lúc bắt đầu beat; 'none' = im lặng
	sfx?: Sfx | 'none';
};

// Từ hiển thị + mốc thời gian (giây) lấy từ WordBoundary của edge-tts
export type Word = {
	text: string;
	start: number;
	end: number;
};

export type Line = {
	text: string;
	emotion: Emotion;
	speaker?: Speaker;
	start: number;
	end: number;
	words: Word[];
	beats?: Beat[];
	// Định dạng cũ (script.txt): hình + nhãn khai báo cho cả câu, engine tự chia beat
	props?: Prop[];
	label?: string | null;
};

// Sinh ra bởi tools/tts/make_voice.py từ spec.json
export type Manifest = {
	fps: number;
	duration: number;
	// Tiêu đề video (render.ts chép từ spec.title) -> chữ trên ảnh bìa
	title?: string | null;
	hook?: string | null;
	music?: string | null;
	guest?: Guest | null;
	lines: Line[];
	envelope: number[];
};

// Kịch bản đầu vào của engine (spec.json) — Phase 2 (packages/brain) sinh ra từ chủ đề
export type SpecLine = {
	text: string;
	emotion?: Emotion;
	speaker?: Speaker;
	beats?: Beat[];
	props?: Prop[];
	label?: string;
};

export type VideoSpec = {
	// Tiêu đề khi đăng, cũng là chữ trên ảnh bìa (src/Cover.tsx)
	title?: string;
	hook?: string;
	music?: string;
	guest?: Guest;
	lines: SpecLine[];
};
