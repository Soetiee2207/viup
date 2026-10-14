F = "font-family='DejaVu Sans, Arial, sans-serif'"
INK = "#1f2937"; MUTED = "#6b7280"

def esc(s): return s.replace("`","").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def box(x,y,w,h,title,lines=(),fill="#ffffff",stroke="#94a3b8",tsize=24,mono=False):
    out=[f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='16' fill='{fill}' stroke='{stroke}' stroke-width='2.5'/>"]
    out.append(f"<text x='{x+w/2}' y='{y+38}' {F} font-size='{tsize}' font-weight='bold' fill='{INK}' text-anchor='middle'>{esc(title)}</text>")
    for i,l in enumerate(lines):
        fam = "font-family='DejaVu Sans Mono, monospace'" if l.startswith("`") else F
        l=l.replace("`","")
        out.append(f"<text x='{x+w/2}' y='{y+72+i*28}' {fam} font-size='19' fill='{MUTED if not fam.startswith(chr(102)+'ont-family=\'DejaVu Sans Mono') else INK}' text-anchor='middle'>{esc(l)}</text>")
    return "\n".join(out)

def arrow(x1,y1,x2,y2,label="",lx=None,ly=None,color="#2563eb",anchor="middle"):
    s=f"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='{color}' stroke-width='3.5' marker-end='url(#a)'/>"
    if label:
        lx = (x1+x2)/2 if lx is None else lx; ly=(y1+y2)/2-12 if ly is None else ly
        for i,t in enumerate(label.split("\n")):
            tw=len(t)*11+16
            bx={"middle":lx-tw/2,"start":lx-8,"end":lx-tw+8}[anchor]
            s+=f"<rect x='{bx}' y='{ly+i*24-19}' width='{tw}' height='26' rx='6' fill='white' stroke='{color}' stroke-width='1.5'/>"
            s+=f"<text x='{lx}' y='{ly+i*24}' {F} font-size='19' fill='{color}' font-weight='bold' text-anchor='{anchor}'>{esc(t)}</text>"
    return s

def svg(w,h,body,title,subtitle):
    return f"""<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>
<defs><marker id='a' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='7' markerHeight='7' orient='auto-start-reverse'><path d='M0,0 L10,5 L0,10 z' fill='#2563eb'/></marker></defs>
<rect width='{w}' height='{h}' fill='#f8fafc'/>
<text x='60' y='70' {F} font-size='36' font-weight='bold' fill='{INK}'>{esc(title)}</text>
<text x='60' y='108' {F} font-size='21' fill='{MUTED}'>{esc(subtitle)}</text>
{body}
</svg>"""

# ---------- Architecture ----------
b=[]
b.append(f"<rect x='60' y='150' width='620' height='720' rx='22' fill='#eef2ff' stroke='#6366f1' stroke-width='3' stroke-dasharray='10 8'/>")
b.append(f"<text x='370' y='192' {F} font-size='25' font-weight='bold' fill='#4338ca' text-anchor='middle'>Operator's own computer (local only)</text>")
b.append(box(110,225,520,150,"Video renderer (Remotion)",["Renders animated Shorts from a script","`out/short.mp4`"]))
b.append(box(110,430,520,170,"viup CLI (packages/publish)",["`npm run yt:auth`  – OAuth sign-in","`npm run yt:upload` – upload a video","Run manually by the channel owner"],fill="#ffffff",stroke="#6366f1"))
b.append(box(110,660,520,170,"Local storage (never shared)",["`secrets/youtube_client.json`","`secrets/youtube_token.json`","`data/viup.db` (local SQLite)"]))
b.append(arrow(370,375,370,428))
b.append(f"<text x='385' y='634' {F} font-size='18' fill='#2563eb' font-weight='bold'>stores token</text>")

b.append(f"<rect x='800' y='150' width='740' height='720' rx='22' fill='#fef2f2' stroke='#ef4444' stroke-width='3' stroke-dasharray='10 8'/>")
b.append(f"<text x='1170' y='192' {F} font-size='25' font-weight='bold' fill='#b91c1c' text-anchor='middle'>Google / YouTube</text>")
b.append(box(860,225,620,170,"Google OAuth 2.0",["accounts.google.com consent screen","Authorization code + PKCE (S256)","Loopback redirect http://127.0.0.1"],stroke="#ef4444"))
b.append(box(860,445,620,190,"YouTube Data API v3",["`videos.insert` (resumable upload)","Scopes: youtube.upload, youtube.readonly"],stroke="#ef4444"))
b.append(box(860,690,620,140,"Operator's own YouTube channel",["Uploaded as private by default","Visible in YouTube Studio"],stroke="#ef4444"))
b.append(arrow(632,470,858,330))
b.append(arrow(858,380,632,515))
b.append(arrow(632,560,858,540))
b.append(arrow(1170,635,1170,688))
b.append(arrow(370,600,370,658))
for t,x,y in [("1. sign-in & consent",745,382),("2. tokens",745,468),("3. upload video",745,575)]:
    tw=len(t)*11+16
    b.append(f"<rect x='{x-tw/2}' y='{y-19}' width='{tw}' height='26' rx='6' fill='white' stroke='#2563eb' stroke-width='1.5'/><text x='{x}' y='{y}' {F} font-size='19' fill='#2563eb' font-weight='bold' text-anchor='middle'>{esc(t)}</text>")
b.append(f"<text x='1185' y='668' {F} font-size='18' fill='#2563eb' font-weight='bold'>4. published to own channel</text>")
notes=["• Single user: the channel owner. No public app, no other accounts, no backend server.",
       "• Data stays on the operator's computer; nothing is sold or shared with third parties.",
       "• Access can be revoked anytime at https://security.google.com/settings/security/permissions",
       "• Privacy: https://soetiee2207.github.io/viup/privacy/   ·   Terms: https://soetiee2207.github.io/viup/terms/"]
for i,n in enumerate(notes):
    b.append(f"<text x='60' y='{925+i*34}' {F} font-size='20' fill='{INK}'>{esc(n)}</text>")
open("architecture.svg","w").write(svg(1600,1080,"\n".join(b),"viup – Architecture","Internal tool that uploads my own videos to my own YouTube channel via YouTube API Services"))

# ---------- User flow ----------
steps=[
 ("1. Start sign-in","Operator runs `npm run yt:auth` on their computer",""),
 ("2. Google consent screen","Browser opens accounts.google.com · app \"viup\" asks for","youtube.upload + youtube.readonly · operator clicks Allow"),
 ("3. Token saved locally","Google redirects to 127.0.0.1 · viup exchanges the code (PKCE)","Refresh token stored in secrets/youtube_token.json"),
 ("4. Render a video","Operator renders a Short locally (`npm run render`) → out/short.mp4",""),
 ("5. Upload","Operator runs `npm run yt:upload` → videos.insert (resumable)","privacyStatus = private · madeForKids = false · title from script"),
 ("6. Result","The video appears in YouTube Studio on the operator's own channel",""),
]
b=[]; x=160; w=1000; y0=150; h=120; gap=50
for i,(t,l1,l2) in enumerate(steps):
    y=y0+i*(h+gap)
    hl = i==1
    b.append(f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='16' fill='{'#fff7ed' if hl else '#ffffff'}' stroke='{'#f97316' if hl else '#94a3b8'}' stroke-width='2.5'/>")
    b.append(f"<circle cx='{x-50}' cy='{y+h/2}' r='30' fill='#2563eb'/><text x='{x-50}' y='{y+h/2+10}' {F} font-size='28' font-weight='bold' fill='white' text-anchor='middle'>{i+1}</text>")
    b.append(f"<text x='{x+30}' y='{y+40}' {F} font-size='25' font-weight='bold' fill='{INK}'>{esc(t[3:])}</text>")
    for k,l in enumerate([l1,l2]):
        if l: b.append(f"<text x='{x+30}' y='{y+75+k*28}' {F} font-size='20' fill='{MUTED}'>{esc(l)}</text>")
    if i<len(steps)-1: b.append(arrow(x+w/2,y+h,x+w/2,y+h+gap-2))
yb=y0+len(steps)*(h+gap)+10
b.append(f"<rect x='{x}' y='{yb}' width='{w}' height='110' rx='16' fill='#f0fdf4' stroke='#22c55e' stroke-width='2.5' stroke-dasharray='8 6'/>")
b.append(f"<text x='{x+30}' y='{yb+42}' {F} font-size='23' font-weight='bold' fill='#15803d'>Revoke anytime</text>")
b.append(f"<text x='{x+30}' y='{yb+78}' {F} font-size='20' fill='{MUTED}'>https://security.google.com/settings/security/permissions → token stops working</text>")
open("user-flow.svg","w").write(svg(1280,yb+160,"\n".join(b),"viup – User flow","Operated only by the channel owner, step by step"))
