import { useState } from 'react';
import { EditorQuiz } from './EditorQuiz';
import { ListaQuizzes } from './ListaQuizzes';

/** Pestaña Quizzes: la lista, o el editor de uno. */
export function Quizzes() {
  const [editando, setEditando] = useState<number | null>(null);
  return editando === null ? (
    <ListaQuizzes onEditar={setEditando} />
  ) : (
    <EditorQuiz key={editando} id={editando} onSalir={() => setEditando(null)} />
  );
}
