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
