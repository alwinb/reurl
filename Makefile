.PHONY: all clean

files = browser.js index.js
sources = $(addprefix lib/, $(files))

#run: all
#	@ echo $(sources)

all: dist/reurl.min.js

dist/reurl.min.js: dist/ package.json $(sources)
	@ echo "Making a minified browser bundle"
	@ esbuild --bundle --minify lib/browser.js > dist/reurl.min.js

dist/:
	@ mkdir dist/

clean:
	@ echo "Removing dist/ directory"
	@ test -d dist/ && rm -r dist/ || exit 0

# tests:
# 	https://raw.githubusercontent.com/web-platform-tests/wpt/master/url/resources/urltestdata.json