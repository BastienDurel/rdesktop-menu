SRC = *.js metadata.json stylesheet.css
DOC = README.md example.conf

GS = gnome-shell/extensions/
DEST := $(shell echo $${XDG_DATA_HOME:-$$HOME/.local/share}/$(GS))

install: $(SRC)
	cp $(SRC) $(DOC) "$(DEST)"
