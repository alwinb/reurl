.PHONY: all test clean update testclean distclean

files = index.js
sources = $(addprefix lib/, $(files))

#run: all
#	@ echo $(sources)

all: dist/reurl.min.js

test: test/run/urltestdata.json
	@ echo ""
	@ node test/run.js
	@ echo ""

clean: testclean distclean

## ES module Bundle

dist/reurl.min.js: dist/ package.json $(sources)
	@ echo "Making a minified ES module bundle"
	@ esbuild --bundle  --format=esm --minify lib/index.js > dist/reurl.min.js

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

