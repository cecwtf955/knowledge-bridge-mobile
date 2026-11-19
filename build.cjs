const esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['src/main.js'],bundle:true,platform:'browser',format:'cjs',target:'es2020',external:['obsidian'],outfile:'main.js'});
