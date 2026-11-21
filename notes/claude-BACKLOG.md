# Claude lane backlog: Computer view

Lane: public/index.html, style.css, common.js, computer.js, computer.css. Server on :4317.

## MUST (Computer view, AGENT_PROMPT §5)
- [x] 0. index.html: link computer.css, globe.css, phone.css, phone.js; enable Phone tab; empty #view-phone
- [ ] 1. Drawn laptop (lid, bezel, screen, base, keyboard, trackpad), scales to window, no h-scroll
- [ ] 2. Webcam on bezel: LED glow, lens pulse, white flash once, `● REC · <app>`; camera key mirrors state
- [ ] 3. Mic key in function row: slashed when idle ("muted"), orange glow + pulse + pressed when in use; caption names app
- [ ] 4. Side panel: mic/cam times today, time in use today, recent apps with relative times
- [ ] 5. Desktop icons: real icons / initials, stable positions, company + tracker badges, mic (orange) / cam (green) rings
- [ ] 6. "The internet" strip: top company chips (flag, red if tracker), "+N more"
- [ ] 7. Wires: app→company (rate ∝ sockets), local app↔app both ways, shared dashed "both → X"; one rAF loop; toggles
- [ ] 8. Click app: side panel destinations + local peers; highlight its wires, dim the rest
- [ ] 9. Live activity feed (sentences, newest first) + toasts for mic/cam/tracker
- [ ] 10. Top bar stats + mic/camera/live pills

## SHOULD
- [ ] 12. Admin hint when dnsCacheAvailable is false
- [ ] 13. <5% CPU idle; keyed in-place DOM updates
- [ ] 14. 1280×800 + projector readable; high-contrast mode
- [ ] 15. Demo spotlight button

## Discovered
