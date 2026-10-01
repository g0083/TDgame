const config = {
  src: 'public/icons/source.svg',
  images: ['public/icons/source.svg'],
  outDir: 'public/icons',
  name: '',
  preset: 'minimal',
  manifest: false,
  html: false,
  instructions: [
    { name: 'icon-192', sizes: [192], type: 'png' },
    { name: 'icon-512', sizes: [512], type: 'png' },
    { name: 'icon-64', sizes: [64], type: 'png' },
    { name: 'apple-touch-icon', sizes: [180], type: 'png' },
    { name: 'icon-maskable-192', sizes: [192], type: 'png', purpose: 'maskable', background: '#0b1020' },
    { name: 'icon-maskable-512', sizes: [512], type: 'png', purpose: 'maskable', background: '#0b1020' },
  ],
}

export default config
