const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

require('dotenv').config();

module.exports = (env, argv) => {
  // Same-origin in production (FastAPI serves the bundle); separate port in dev.
  // Honour an explicit API_BASE env override for non-standard setups.
  const apiBase =
    process.env.API_BASE !== undefined
      ? process.env.API_BASE
      : argv.mode === 'production'
        ? ''
        : 'http://localhost:8787';

  return {
  entry: './src/main.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true,
    publicPath: '/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
    }),
    new webpack.DefinePlugin({
      'process.env.MAPBOX_TOKEN': JSON.stringify(process.env.MAPBOX_TOKEN),
      'process.env.API_BASE': JSON.stringify(apiBase),
    }),
  ],
  devServer: {
    port: 5173,
    historyApiFallback: true,
    hot: true,
    open: true,
  },
    mode: argv.mode || 'development',
    devtool: argv.mode === 'production' ? false : 'eval-source-map',
    performance: { hints: false },
  };
};
