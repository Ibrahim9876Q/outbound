import cv2, numpy as np, wave
cap=cv2.VideoCapture('ref.mp4'); prev=None; i=0; cuts=[]
while True:
    ok,f=cap.read()
    if not ok: break
    g=cv2.resize(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY),(128,72)).astype(np.float32)
    if prev is not None:
        d=np.abs(g-prev).mean()
        if d>6: cuts.append((round(i/30,2),round(d,1)))
    prev=g; i+=1
print('frames',i); print('CUTS',cuts)
w=wave.open('audio.wav'); sr=w.getframerate(); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
hop=512; n=len(a)//hop
rms=np.array([np.sqrt((a[k*hop:(k+1)*hop]**2).mean()) for k in range(n)])
# low band energy (kick) via simple spectral flux
win=1024; spec=[]
for k in range(0,len(a)-win,hop):
    s=np.abs(np.fft.rfft(a[k:k+win]*np.hanning(win))); spec.append(s)
spec=np.array(spec); flux=np.maximum(0,np.diff(spec,axis=0)).sum(1)
low=spec[:,1:8].sum(1)  # <~150Hz
t=lambda k: k*hop/sr
# per half-second summary
for s in np.arange(0,45,0.5):
    k0=int(s*sr/hop); k1=int((s+0.5)*sr/hop)
    print(f"{s:5.1f} rms={rms[k0:k1].mean():.3f} low={low[k0:k1].mean():7.1f} flux={flux[k0:k1].mean():6.1f}")
# onset peaks
th=np.percentile(flux,90); pk=[k for k in range(1,len(flux)-1) if flux[k]>th and flux[k]>=flux[k-1] and flux[k]>=flux[k+1]]
print('ONSETS',[round(t(k),2) for k in pk])
# tempo via autocorrelation of flux
f=flux-flux.mean(); ac=np.correlate(f,f,'full')[len(f)-1:]
lags=np.arange(len(ac)); bpm=60/(lags*hop/sr+1e-9); m=(bpm>70)&(bpm<180)
L=lags[m][np.argmax(ac[m])]; print('BPM',60/(L*hop/sr))
