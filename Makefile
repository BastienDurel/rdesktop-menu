SRC = *.js metadata.json stylesheet.css
DOC = README.md example.conf

GS = gnome-shell/extensions/rdesktop-menu@bastien.git.geekwu.org/
DEST := $(shell echo $${XDG_DATA_HOME:-$$HOME/.local/share}/$(GS))
ZIP = rdesktop-menu@bastien.git.geekwu.org.zip

install: $(SRC)
	cp $(SRC) $(DOC) "$(DEST)"
package: $(ZIP)
$(ZIP): $(SRC)
	zip -j $@ *.js metadata.json stylesheet.css README.md example.conf
node_modules:
	npm install
lint: $(SRC) node_modules
	./node_modules/eslint/bin/eslint.js extension.js
test: install
	env GNOME_SHELL_SLOWDOWN_FACTOR=2 MUTTER_DEBUG_DUMMY_MODE_SPECS=1600x960 dbus-run-session -- gnome-shell --nested --wayland
