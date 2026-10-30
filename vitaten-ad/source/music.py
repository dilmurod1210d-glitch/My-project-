import numpy as np, wave
sr=44100; D=27; bpm=112; beat=60/bpm
t=np.arange(int(sr*D))/sr; out=np.zeros_like(t)
f=lambda n:440*2**((n-69)/12)
prog=[[60,64,67],[67,71,74],[69,72,76],[65,69,72]]
bar=4*beat
def add(sig,start):
    i=int(start*sr)
    if i>=len(out): return
    j=min(len(out),i+len(sig)); out[i:j]+=sig[:j-i]
for k in range(int(D/bar)+1):
    ch=prog[k%4]; dur=bar; tt=np.arange(int(sr*dur))/sr
    env=np.minimum(1,tt/0.4)*np.minimum(1,(dur-tt)/0.4)
    for n in ch: add(0.05*env*(np.sin(2*np.pi*f(n-12)*tt)+0.3*np.sin(2*np.pi*f(n)*tt*1.003)),k*bar)
    for b in range(4):
        tb=np.arange(int(sr*beat))/sr; add(0.12*np.exp(-tb*5)*np.sin(2*np.pi*f(ch[0]-24)*tb),k*bar+b*beat)
step=beat/2; pat=[0,1,2,1,0,2,1,2]
for s in range(int(D/step)):
    k=int(s*step/bar); ch=prog[k%4]; n=ch[pat[s%8]]+12+(12 if s%8==7 else 0)
    tt=np.arange(int(sr*0.5))/sr; env=np.exp(-tt*9)
    add(0.09*env*(np.sin(2*np.pi*f(n)*tt)+0.25*np.sin(4*np.pi*f(n)*tt)+0.1*np.sin(6*np.pi*f(n)*tt)),s*step)
rng=np.random.default_rng(1)
for s in range(int(D/beat)):
    tt=np.arange(int(sr*0.08))/sr; add(0.035*np.exp(-tt*60)*rng.standard_normal(len(tt)),s*beat+beat/2)
for ts in [4.4,22.3]:
    for i,n in enumerate([84,88,91,96]):
        tt=np.arange(int(sr*1.2))/sr; add(0.06*np.exp(-tt*3)*np.sin(2*np.pi*f(n)*tt),ts+i*0.07)
out*=np.minimum(1,t/1.0)*np.minimum(1,(D-t)/1.5)
out=out/np.max(np.abs(out))*0.8
R=np.concatenate([np.zeros(int(sr*0.012)),out])[:len(out)]
data=(np.stack([out,R],1)*32767).astype(np.int16)
w=wave.open('music.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(data.tobytes());w.close()
