// Webpack configuration for SDK bundling
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/sdk/PaymentGateway.js',
  output: {
    filename: 'checkout.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'PaymentGateway',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};
