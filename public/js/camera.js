class CameraCapture {
  constructor() {
    this.video = null;
    this.stream = null;
    this.canvas = document.createElement('canvas');
    this.photos = [];
    this.overlay = null;
    this.facingMode = 'environment';
  }

  async open() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'camera-overlay';
    this.overlay.innerHTML =
      '<div class="camera-viewfinder">' +
        '<video autoplay playsinline muted></video>' +
        '<div class="camera-watermark-preview"></div>' +
      '</div>' +
      '<div class="camera-bottom">' +
        '<div class="camera-photo-count">已拍 <span class="count">0</span> 张</div>' +
        '<div class="camera-actions">' +
          '<button class="btn-camera-close" type="button">关闭</button>' +
          '<button class="btn-camera-capture" type="button"></button>' +
          '<button class="btn-camera-switch" type="button">翻转</button>' +
        '</div>' +
      '</div>' +
      '<div class="camera-flash"></div>';

    document.body.appendChild(this.overlay);
    this.video = this.overlay.querySelector('video');

    await this._startStream();

    this.overlay.querySelector('.btn-camera-capture').onclick = () => this.capture();
    this.overlay.querySelector('.btn-camera-close').onclick = () => this.close();
    this.overlay.querySelector('.btn-camera-switch').onclick = () => this._switchCamera();

    this._updateWatermarkPreview();
    this._previewInterval = setInterval(() => this._updateWatermarkPreview(), 1000);
  }

  async _startStream() {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
    } catch (err) {
      Utils.showToast('无法访问摄像头: ' + err.message, 'error');
      throw err;
    }
  }

  async _switchCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    await this._startStream();
  }

  _updateWatermarkPreview() {
    const el = this.overlay.querySelector('.camera-watermark-preview');
    if (!el) return;
    const user = AUTH.getUser();
    const now = Utils.formatDateTime(new Date());
    el.innerHTML =
      '<div>' + now + '</div>' +
      '<div>检查员: ' + (user ? user.realName : '') + '</div>';
  }

  async capture() {
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (!width || !height) return;

    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, width, height);

    const gps = await GPS.getCurrentPosition(5000);
    const now = new Date();
    const user = AUTH.getUser();

    const watermarkInfo = {
      time: Utils.formatDateTime(now),
      location: gps.lat ? (gps.lat.toFixed(6) + ', ' + gps.lng.toFixed(6)) : 'GPS不可用',
      inspector: user ? user.realName : '',
    };

    this._applyWatermark(ctx, width, height, watermarkInfo);

    const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/jpeg', 0.85));
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.85);

    this.photos.push({
      blob: blob,
      dataUrl: dataUrl,
      takenAt: now.toISOString(),
      watermarkInfo: watermarkInfo,
    });

    // Flash effect
    const flash = this.overlay.querySelector('.camera-flash');
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 200);

    // Update counter
    this.overlay.querySelector('.count').textContent = this.photos.length;
  }

  _applyWatermark(ctx, width, height, info) {
    var fontSize = Math.max(14, Math.floor(width / 40));
    var padding = fontSize * 0.8;
    var lineHeight = fontSize * 1.4;
    var stripHeight = lineHeight * 3.5 + padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, height - stripHeight, width, stripHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = fontSize + 'px sans-serif';
    ctx.textAlign = 'left';

    var y = height - stripHeight + padding + fontSize;
    ctx.fillText('时间: ' + info.time, padding, y);
    y += lineHeight;
    ctx.fillText('位置: ' + info.location, padding, y);
    y += lineHeight;
    ctx.fillText('检查员: ' + info.inspector, padding, y);
  }

  close() {
    if (this._previewInterval) clearInterval(this._previewInterval);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    if (this.overlay) {
      this.overlay.remove();
    }
  }

  getPhotos() {
    return this.photos;
  }

  removePhoto(index) {
    this.photos.splice(index, 1);
  }
}
