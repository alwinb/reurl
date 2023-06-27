.PHONY: all test clean update testclean distclean

files = index.js
sources = $(addprefix lib/, $(files))

#run: all
#	@ echo $(sources)

all: dist/reurl.min.js dist/reurl.cjs dist/reurl.min.cjs

test: test/run/urltestdata.json
	@ echo ""
	@ node test/run.js
	@ echo ""

clean: testclean distclean

## ES Module Bundle

dist/reurl.min.js: dist/ package.json $(sources)
	@ echo "Making a minified ES module bundle"
	@ esbuild --bundle  --format=esm --minify lib/index.js > dist/reurl.min.js

## CommonJS bundle

dist/reurl.cjs: dist/ package.json $(sources)
	@ echo "Making a minified CommonJS bundle"
	@ esbuild --bundle  --format=cjs lib/index.js > dist/reurl.cjs

## CommonJS bundle (minified)

dist/reurl.min.cjs: dist/ package.json $(sources)
	@ echo "Making a minified CommonJS bundle"
	@ esbuild --bundle  --format=cjs --minify lib/index.js > dist/reurl.min.cjs

dist/:
	@ mkdir dist/

distclean:
	@ echo "Removing dist/ directory"
	@ test -d dist/ && rm -r dist/ || exit 0

## Tests

test-update: testclean test/run/urltestdata.json

test/run/:
	@ mkdir test/run/

test/run/urltestdata.json: test/run/
	@ echo "\nGet latest web platform URL tests"
	@ echo "==================================\n"
	@ curl https://raw.githubusercontent.com/web-platform-tests/wpt/master/url/resources/urltestdata.json > test/run/urltestdata.json

testclean:
	@ test -d test/run/ && echo "Removing test/run/" && rm -r test/run/ || exit 0

