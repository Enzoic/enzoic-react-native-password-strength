module.exports = {
  entry: "./src/index.js",
  externals: {
    "react-native": "react-native",
    react: "react",
    "react-dom": "react-dom"
  },
  output: {
    filename: "./dist/index.js",
    library: "EnzoicReactNativePasswordMeter",
    libraryTarget: "umd",
    path: __dirname
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: /src/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env', 
              "@babel/preset-react", 
              {'plugins': ['@babel/plugin-proposal-class-properties']}
            ]
          },
        },
      },
      {
        test: /\.(png|jpg|gif)$/,
        loader: "url-loader"
      },
    ]
  }
};
