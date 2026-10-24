# Cloudflare Worker relay for YouTube InnerTube + timedtext

**Verdict: unreliable.** A Worker relay may work for a while, but nothing in the sources shows it will hold up. Workers egress from Cloudflare's datacenter ranges, which are the same kind of IPs YouTube is blocking on Render, AWS, GCP and Azure. Every Worker subrequest also carries a `CF-Worker` header that names your zone. And YouTube now wants PO tokens from the ANDROID player client. Treat a Worker as a cheap experiment, not a fix.

## Findings

### 1. Are Worker egress IPs blocked by YouTube?
- I found no primary-source report specific to Workers, in either direction. Searches of GitHub issues and forums turned up no Worker-specific 403 or `LOGIN_REQUIRED` threads.
- The general pattern is well documented. The youtube-transcript-api README says "YouTube has started blocking most IPs that are known to belong to cloud providers" and recommends rotating residential proxies. It also says static proxies get banned "after extended use". https://github.com/jdepoix/youtube-transcript-api
- An issue in the same project reports that the library works locally and fails from AWS. It also says datacenter proxies get blocked. https://github.com/jdepoix/youtube-transcript-api/issues/593
- Render staff attribute YouTube's sign-in prompts to shared outbound IPs. https://community.render.com/t/yt-dlp-sign-in-problem/26692
- Maintainers of YouTube front ends report that blocks hit whole IP ranges. https://github.com/jagrosh/MusicBot/issues/1588 , https://github.com/alexta69/metube/issues/595
- One counterpoint: a write-up reports that egress through Cloudflare **WARP**, not Workers, got past YouTube's API restrictions. That suggests Cloudflare IP space is not blanket-banned, but WARP is a different product with different egress. https://blog.arfevrier.fr/leveraging-cloudflare-warp-to-bypass-youtubes-api-restrictions/

### 2. Does Worker fetch() reveal itself?
- Yes. Cloudflare's docs say "CF-Worker is added to all Worker subrequests sent via fetch()", and its value is the zone that owns the Worker. https://developers.cloudflare.com/fundamentals/reference/http-headers/
- For a destination that is not a Cloudflare zone, like youtube.com, the Worker sets `CF-Connecting-IP` and `X-Real-IP` itself. Same source.
- Neither header can hide that the source IP is datacenter space.

### 3. Are caption baseUrls tied to the requesting IP?
- Timedtext URLs carry `ip`, `ipbits`, `expire`, `sparams` and `signature`, and community reports say they stay valid for about 7 minutes. https://community.make.com/t/youtube-transcript/27310
- `sparams` lists the signed parameters, and `ip` is among them. My inference is that a baseUrl fetched through the Worker must also be fetched through the Worker. YouTube does not document this. Plan for both calls to go through the relay.
- yt-dlp's PO Token guide lists ANDROID as needing a PO token for "GVS or Player". It says subtitles need one only on the web client. https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- So the ANDROID player call can fail no matter which IP it comes from.

### 4. Free tier limits and terms
- Free plan: 100,000 requests/day, 50 subrequests per request (each redirect counts), and 10 ms CPU per request. Time spent waiting on the network doesn't count toward CPU. https://developers.cloudflare.com/workers/platform/limits/
- A player call plus a timedtext call is about 2 subrequests, well inside these limits.
- The Developer Platform terms don't mention proxying. They do require following the docs and applicable third-party terms, and they let Cloudflare suspend accounts for violations. https://www.cloudflare.com/service-specific-terms-developer-platform/
- Relaying requests to scrape YouTube likely conflicts with YouTube's ToS, and through that clause with Cloudflare's.

### 5. Alternatives
- Rotating residential proxy, as youtube-transcript-api recommends. Webshare is the provider its author names. https://github.com/jdepoix/youtube-transcript-api
- Generate PO tokens, as described in yt-dlp's guide. https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- Fetch transcripts client-side from the visitor's browser and send them to the server. This uses residential IPs at no cost, but CORS may require a browser extension.
- Lean on the pre-indexed featured videos (`npm run index` run locally), and treat pasted videos as best-effort.
- A paid managed transcript API.

## How to test
Deploy a roughly 20-line Worker that forwards the POST and the timedtext GET. Call it for 10 to 20 videos across a few days. Log `playabilityStatus.status`. Any `LOGIN_REQUIRED` or 403 means the relay won't hold up.
