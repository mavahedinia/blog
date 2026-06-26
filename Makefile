.PHONY: install dev build create-post

BUILD_DIR  ?= dist
CATEGORY   ?= engineering
DRAFT      ?= false
TITLE      ?=

install:
	npm install

dev:
	npm run dev

build:
	npm run build -- --outDir $(BUILD_DIR)

create-post:
	@title="$(TITLE)"; \
	if [ -z "$$title" ]; then \
		printf "Post title: "; \
		read title; \
	fi; \
	category="$(CATEGORY)"; \
	slug=$$(echo "$$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$$//'); \
	dir="src/content/blog/$$slug"; \
	if [ -d "$$dir" ]; then \
		echo "Error: $$dir already exists" >&2; \
		exit 1; \
	fi; \
	mkdir -p "$$dir"; \
	today=$$(date +%Y-%m-%d); \
	draft_line=""; \
	if [ "$(DRAFT)" = "true" ]; then draft_line="draft: true"; fi; \
	{ \
		printf '%s\n' \
			'---' \
			"title: \"$$title\"" \
			'excerpt: ""' \
			"date: $$today" \
			'readingTime: 1' \
			"category: \"$$category\"" \
			'tags: []' \
			'author: "amin"' \
			'lang: "en"' \
			'thumbnail: ./thumb.png'; \
		[ -n "$$draft_line" ] && printf '%s\n' "$$draft_line"; \
		printf '%s\n' '---' ''; \
	} > "$$dir/index.mdx"; \
	echo "Created: $$dir/index.mdx"
