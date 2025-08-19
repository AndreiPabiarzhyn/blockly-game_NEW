// blocks.js — только нужные блоки и генераторы
(function () {
  // Совместимо с v9–v13 Blockly
  const JS = Blockly.JavaScript || Blockly.javascriptGenerator;
  const ORDER_ATOMIC = JS && (JS.ORDER_ATOMIC ?? 0);
  function regGen(name, fn) {
    if (!JS) return;
    JS[name] = fn;
    if (JS.forBlock) JS.forBlock[name] = fn; // новый API
  }

  // Старт (удалять нельзя)
  Blockly.Blocks["when_run"] = {
    init: function () {
      this.appendDummyInput().appendField("Когда запущено");
      this.setNextStatement(true, null);
      this.setColour("#0ea5e9");
      this.setTooltip("Начало программы.");
      this.setDeletable(false);
    },
  };
  regGen("when_run", () => "");

  // Движение по 1 клетке
  function makeMoveBlock(type, label) {
    Blockly.Blocks[type] = {
      init: function () {
        this.appendDummyInput().appendField(label);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour("#4f46e5");
      },
    };
  }
  makeMoveBlock("move_right", "Вправо➡️");
  makeMoveBlock("move_left",  "Влево⬅️");
  makeMoveBlock("move_up",    "Вверх⬆️");
  makeMoveBlock("move_down",  "Вниз⬇️");

  regGen("move_right", () => "await __move(1,0);\n");
  regGen("move_left",  () => "await __move(-1,0);\n");
  regGen("move_up",    () => "await __move(0,-1);\n");
  regGen("move_down",  () => "await __move(0,1);\n");

  // Собрать
  Blockly.Blocks["pick_coin"] = {
    init: function () {
      this.appendDummyInput().appendField("Собрать");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#8b5cf6");
    },
  };
  regGen("pick_coin", () => "await __pick();\n");

  // Выпадающее число для «повторить N раз»
  Blockly.Blocks["repeat_count"] = {
    init: function () {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown(
            [["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],
             ["6","6"],["7","7"],["8","8"],["9","9"],["10","10"]]
          ),
          "NUM"
        );
      this.setOutput(true, "Number");
      this.setColour("#06b6d4");
      this.setTooltip("Количество повторений.");
    },
  };
  regGen("repeat_count", (block) => [block.getFieldValue("NUM") || "1", ORDER_ATOMIC]);
})();
