---
layout: home
title: viup
---

<p align="center"><img src="{{ '/assets/crab.png' | relative_url }}" alt="Cua Biết Tuốt mascot" width="220"></p>

## What is viup?

**viup** is a personal, non-commercial software tool operated by a single individual. It produces short, original 2D animated educational videos featuring our own mascot, **"Cua Biết Tuốt"** (the know-it-all crab), and publishes them to the operator's **own** channels on YouTube, TikTok and Facebook.

- All characters and artwork are original creations of the channel.
- Video scripts are generated with AI assistance and pass an automated quality check (facts against the source, safety, no copying) before publishing.
- Videos are labeled as AI-generated / altered content where the platform supports it.
- viup is **not** offered to the public and has no external users. It only connects to accounts owned by the operator.

### How viup uses platform APIs

| Platform | What viup does | Scopes |
|---|---|---|
| YouTube (YouTube API Services) | Uploads videos to the operator's own channel; reads that channel's video statistics | `youtube.upload`, `youtube.readonly` |
| TikTok (Content Posting API) | Sends videos to the operator's own TikTok inbox as drafts for the owner to review and post | `user.info.basic`, `video.upload` |

- [Privacy Policy]({{ '/privacy' | relative_url }})
- [Terms of Service]({{ '/terms' | relative_url }})
- Source code: [github.com/Soetiee2207/viup](https://github.com/Soetiee2207/viup)

---

## viup là gì?

**viup** là công cụ phần mềm cá nhân, phi thương mại, do một cá nhân vận hành. Công cụ tự sản xuất video hoạt hình 2D ngắn mang tính giáo dục với mascot riêng **"Cua Biết Tuốt"**, và đăng lên **chính** các kênh YouTube, TikTok, Facebook của người vận hành.

Mọi nhân vật đều do kênh tự thiết kế. Nội dung có AI hỗ trợ, được kiểm tra tự động trước khi đăng và được gắn nhãn nội dung AI khi nền tảng hỗ trợ. viup không cung cấp cho người dùng bên ngoài.
