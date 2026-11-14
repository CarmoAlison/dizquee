import { listCategories } from '../services/categoriesService'
import { useAsync } from './useAsync'

export function useCategories() {
  const { data, loading, error, reload, setData } = useAsync(listCategories, [])
  return { categories: data || [], loading, error, reload, setCategories: setData }
}
